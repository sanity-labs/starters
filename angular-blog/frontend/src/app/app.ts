import {afterNextRender, Component} from '@angular/core'
import {RouterOutlet} from '@angular/router'
import {initVisualEditing} from './sanity/visual-editing'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <router-outlet />
  `,
  styleUrl: './app.css',
})
export class App {
  constructor() {
    afterNextRender(() => {
      initVisualEditing()
    })
  }
}
