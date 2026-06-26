import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core'
import {ActivatedRoute, RouterLink} from '@angular/router'
import {DatePipe} from '@angular/common'
import {PortableTextComponent} from '../components/portable-text.component'
import {SanityService, type PostDetail} from '../sanity/sanity.service'
import {SanityImageService} from '../sanity/sanity-image.service'
import {postBySlugQuery} from '../sanity/queries'

@Component({
  selector: 'app-post',
  standalone: true,
  imports: [RouterLink, DatePipe, PortableTextComponent],
  template: `
    <main class="container">
      <p><a routerLink="/">← All posts</a></p>

      @if (post(); as p) {
        <article>
          @if (coverUrl()) {
            <img [src]="coverUrl()" [alt]="p.title" width="960" height="540" />
          }
          <h1>{{ p.title }}</h1>
          @if (p.author?.name) {
            <p class="byline">
              @if (authorImageUrl()) {
                <img
                  class="byline-avatar"
                  [src]="authorImageUrl()"
                  [alt]="p.author.name"
                  width="40"
                  height="40"
                />
              }
              <span>By {{ p.author.name }}</span>
            </p>
          }
          @if (p.publishedAt) {
            <time>{{ p.publishedAt | date: 'longDate' }}</time>
          }
          @if (p.excerpt) {
            <p class="lede">{{ p.excerpt }}</p>
          }
          <app-portable-text [value]="p.body" />
        </article>
      } @else {
        <h1>Post not found</h1>
      }
    </main>
  `,
})
export class PostComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute)
  private readonly sanity = inject(SanityService)
  private readonly images = inject(SanityImageService)
  private unsub: (() => void) | undefined

  readonly post = signal<PostDetail | null>(null)

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug')
    if (!slug) return
    this.unsub = this.sanity.watchQuery<PostDetail | null>(postBySlugQuery, {slug}, (data) =>
      this.post.set(data),
    )
  }

  ngOnDestroy(): void {
    this.unsub?.()
  }

  coverUrl(): string | undefined {
    return this.images.url(this.post()?.coverImage, 960)
  }

  authorImageUrl(): string | undefined {
    return this.images.url(this.post()?.author?.image, 80)
  }
}
