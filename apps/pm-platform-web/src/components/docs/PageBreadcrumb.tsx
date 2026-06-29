import { Link } from 'react-router-dom';
import type { Page, Space } from '@/types';
export function PageBreadcrumb({ space, page }: { space?: Space; page?: Page }) { return <div className="mb-4 text-sm text-muted-foreground"><Link to="/spaces" className="hover:text-foreground">Spaces</Link> › {space && <Link to={`/spaces/${space.id}`} className="hover:text-foreground">{space.name}</Link>} {page && <>› <span>{page.title}</span></>}</div>; }
