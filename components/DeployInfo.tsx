type DeployInfoProps = {
  serverTime: string;
  nodeEnv: string;
};

/**
 * 배포가 살아 있는지 눈으로 확인하는 칸입니다.
 *
 * 이 값은 브라우저가 아니라 서버에서 만들어집니다.
 * 화면을 새로고침할 때마다 서버 시각이 바뀌면, EC2 의 서버가 실제로 응답하고 있다는 뜻입니다.
 *
 * 서버 내부 경로, 환경변수 값 같은 민감한 정보는 여기에 넣지 마세요.
 */
export function DeployInfo({ serverTime, nodeEnv }: DeployInfoProps) {
  const rows: { label: string; value: string }[] = [
    { label: "서버 시각", value: serverTime },
    { label: "실행 모드", value: nodeEnv },
  ];

  return (
    <section className="card">
      <h2 className="card-title">배포 확인</h2>
      <p className="card-hint">
        새로고침할 때마다 아래 서버 시각이 바뀌면 서버가 정상 동작 중입니다.
      </p>
      <dl className="info-list">
        {rows.map((row) => (
          <div className="info-row" key={row.label}>
            <dt className="info-label">{row.label}</dt>
            <dd className="info-value">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
