import {RenderMode, type ServerRoute} from '@angular/ssr'

export const serverRoutes: ServerRoute[] = [
  {path: '', renderMode: RenderMode.Server},
  {path: 'posts/:slug', renderMode: RenderMode.Server},
  {path: '**', renderMode: RenderMode.Server},
]
