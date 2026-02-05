export type DataSource = 'api' | 'local';

export function canUseDevToggle(user: any) {
  const role = user?.role;
  const features: string[] = user?.features ?? [];
  return role === 'DEVELOPER' || role === 'TESTER' || features.includes('dev_api_toggle');
}

export function getDevDataSource(): DataSource {
  return (localStorage.getItem('relay:dev:dataSource') as DataSource) || 'api';
}

export function setDevDataSource(v: DataSource) {
  localStorage.setItem('relay:dev:dataSource', v);
}
