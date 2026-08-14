import projectJson from "@/project.json";

/**
 * project.json 의 구조입니다.
 * 값은 project.json 한 곳에서만 관리하고, 화면과 API 는 이 파일을 통해 읽습니다.
 */
export type Project = {
  id: string;
  name: string;
  description: string;
  owner: string;
  department: string;
  domain: string;
  port: number;
};

export const project: Project = projectJson;
