/**
 * 데이터베이스 연결입니다.
 *
 * 이 파일은 직접 고칠 일이 거의 없습니다. 아래처럼 가져다 쓰세요.
 *
 *   import { query } from "@/lib/db";
 *
 *   const rows = await query<{ id: number; body: string }>(
 *     "SELECT id, body FROM memo WHERE id = $1",
 *     [memoId],
 *   );
 *
 * 값을 문자열로 이어 붙이지 말고 반드시 $1, $2 자리표시자를 쓰세요.
 * 이어 붙이면 SQL 주입 공격에 뚫립니다.
 *
 *   나쁨: `SELECT * FROM memo WHERE id = ${userInput}`
 *   좋음: query("SELECT * FROM memo WHERE id = $1", [userInput])
 *
 * 접속 주소는 DATABASE_URL 환경변수에서 읽습니다.
 * 로컬은 compose.yaml 이, 배포는 GitHub Actions 가 넣어 줍니다.
 * 이 파일에 비밀번호를 직접 적지 마세요.
 */
import { Pool, type QueryResultRow } from "pg";

/**
 * 개발 중에는 파일이 바뀔 때마다 모듈이 다시 불러와집니다.
 * 그때마다 새 Pool 을 만들면 연결이 계속 쌓여 DB 가 접속 한도에 걸립니다.
 * 그래서 전역에 하나만 두고 재사용합니다.
 */
const globalForDb = globalThis as unknown as { __dbPool?: Pool };

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL 이 없습니다.\n" +
        "  로컬: .env.local 에 DATABASE_URL 을 적거나 docker compose 로 실행하세요.\n" +
        "  배포: project.json 의 database 를 true 로 두면 서버가 자동으로 넣어 줍니다.",
    );
  }

  return new Pool({
    connectionString,
    // 서버 메모리가 넉넉하지 않아 프로젝트당 연결 수를 제한합니다.
    // 공용 PostgreSQL 의 max_connections 는 50 입니다.
    max: 5,
    // 놀고 있는 연결은 30초 뒤에 닫습니다.
    idleTimeoutMillis: 30_000,
    // 10초 안에 연결되지 않으면 포기합니다. 요청이 무한정 매달리지 않게 합니다.
    connectionTimeoutMillis: 10_000,
  });
}

/** 연결 풀입니다. 처음 쓸 때 한 번만 만들어집니다. */
export function getPool(): Pool {
  if (!globalForDb.__dbPool) {
    globalForDb.__dbPool = createPool();
  }
  return globalForDb.__dbPool;
}

/**
 * SQL 한 줄을 실행하고 결과 행들을 돌려줍니다.
 *
 * @param sql    $1, $2 자리표시자를 쓴 SQL
 * @param params 자리표시자에 넣을 값들
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params as unknown[]);
  return result.rows;
}

/**
 * 여러 SQL 을 하나로 묶어 실행합니다.
 * 도중에 오류가 나면 전부 취소되고 아무것도 반영되지 않습니다.
 *
 *   await transaction(async (run) => {
 *     await run("INSERT INTO memo (body) VALUES ($1)", ["첫 줄"]);
 *     await run("INSERT INTO memo (body) VALUES ($1)", ["둘째 줄"]);
 *   });
 */
export async function transaction<T>(
  work: (
    run: <R extends QueryResultRow = QueryResultRow>(
      sql: string,
      params?: readonly unknown[],
    ) => Promise<R[]>,
  ) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    const result = await work(async (sql, params = []) => {
      const r = await client.query(sql, params as unknown[]);
      return r.rows;
    });

    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    // 연결을 반드시 풀에 돌려줍니다. 이걸 빠뜨리면 연결이 새어 나갑니다.
    client.release();
  }
}
