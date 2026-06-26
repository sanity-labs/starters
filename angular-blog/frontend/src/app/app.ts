import {afterNextRender, Component, inject, TransferState} from '@angular/core'
import {Router, RouterOutlet} from '@angular/router'
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
  private readonly router = inject(Router)
  private readonly transferState = inject(TransferState)

  constructor() {
    afterNextRender(() => {
      initVisualEditing(this.router, this.transferState)
    })
  }
}
