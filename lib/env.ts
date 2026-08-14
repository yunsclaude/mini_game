/**
 * 환경변수를 안전하게 읽습니다.
 *
 * - 값이 없거나 비어 있으면 기본값을 사용하므로, .env 없이도 로컬 실행과 Docker 빌드가 됩니다.
 * - 여기에 실제 API 키나 비밀번호를 적지 마세요. 값은 항상 실행 환경에서 주입받습니다.
 * - 비밀값을 다루게 되면 NEXT_PUBLIC_ 접두사를 붙이지 마세요. 브라우저로 그대로 노출됩니다.
 */
function readEnv(value: string | undefined, defaultValue: string): string {
  return value !== undefined && value.trim() !== "" ? value : defaultValue;
}

export const env = {
  /** development | production | test */
  nodeEnv: readEnv(process.env.NODE_ENV, "development"),
  /** 브라우저에도 노출되는 공개 값입니다. */
  appUrl: readEnv(process.env.NEXT_PUBLIC_APP_URL, "http://localhost:3000"),
} as const;
