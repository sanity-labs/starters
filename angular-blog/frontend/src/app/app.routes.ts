import {Routes} from '@angular/router'
import {HomeComponent} from './pages/home.component'
import {PostComponent} from './pages/post.component'

export const routes: Routes = [
  {path: '', component: HomeComponent},
  {path: 'posts/:slug', component: PostComponent},
  {path: '**', component: HomeComponent},
]
