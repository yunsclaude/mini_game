import type { Project } from "@/lib/project";

type ProjectInfoProps = {
  project: Project;
};

export function ProjectInfo({ project }: ProjectInfoProps) {
  const rows: { label: string; value: string }[] = [
    { label: "프로젝트 이름", value: project.name },
    { label: "프로젝트 설명", value: project.description },
    { label: "제작자", value: project.owner },
    { label: "부서", value: project.department },
    { label: "프로젝트 ID", value: project.id },
    { label: "도메인", value: project.domain },
  ];

  return (
    <section className="card">
      <h2 className="card-title">프로젝트 정보</h2>
      <p className="card-hint">
        아래 값은 모두 <code>project.json</code> 에서 읽어옵니다.
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
