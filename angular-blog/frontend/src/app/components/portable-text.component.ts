import {Component, Input} from '@angular/core'
import {toHTML} from '@portabletext/to-html'

@Component({
  selector: 'app-portable-text',
  standalone: true,
  template: `
    <div class="portable-text" [innerHTML]="html"></div>
  `,
})
export class PortableTextComponent {
  @Input({required: true}) set value(blocks: unknown) {
    this.html = toHTML((blocks as Parameters<typeof toHTML>[0]) ?? [])
  }

  html = ''
}
