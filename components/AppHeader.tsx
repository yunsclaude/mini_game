import { StatusBadge } from "@/components/StatusBadge";

type AppHeaderProps = {
  name: string;
  description: string;
  status: string;
};

export function AppHeader({ name, description, status }: AppHeaderProps) {
  return (
    <header className="header">
      <StatusBadge label={status} />
      <h1 className="header-title">{name}</h1>
      <p className="header-description">{description}</p>
    </header>
  );
}
