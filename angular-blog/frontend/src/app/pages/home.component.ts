import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core'
import {RouterLink} from '@angular/router'
import {DatePipe} from '@angular/common'
import {SanityService, type PostListItem, type SiteSettings} from '../sanity/sanity.service'
import {SanityImageService} from '../sanity/sanity-image.service'
import {allPostsQuery, settingsQuery} from '../sanity/queries'

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <main class="container">
      <header class="header">
        @if (logoUrl(settings())) {
          <img [src]="logoUrl(settings())" [alt]="settings()?.title" width="100" height="100" />
        }
        <h1>{{ settings()?.title ?? 'Blog' }}</h1>
        @if (settings()?.description) {
          <p class="lede">{{ settings()?.description }}</p>
        }
      </header>

      <ul class="post-list">
        @for (post of posts(); track post._id) {
          <li>
            <a [routerLink]="['/posts', post.slug]">
              @if (coverUrl(post)) {
                <img [src]="coverUrl(post)" [alt]="post.title" width="640" height="360" />
              }
              <h2>{{ post.title }}</h2>
              @if (post.excerpt) {
                <p>{{ post.excerpt }}</p>
              }
              @if (post.publishedAt) {
                <time>{{ post.publishedAt | date: 'mediumDate' }}</time>
              }
            </a>
          </li>
        } @empty {
          <li><p>No posts yet. Create one in Sanity Studio.</p></li>
        }
      </ul>
    </main>
  `,
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly sanity = inject(SanityService)
  private readonly images = inject(SanityImageService)
  private unsubs: Array<() => void> = []

  readonly posts = signal<PostListItem[]>([])
  readonly settings = signal<SiteSettings | null>(null)

  ngOnInit(): void {
    this.unsubs.push(
      this.sanity.watchQuery<SiteSettings | null>(settingsQuery, {}, (data) =>
        this.settings.set(data),
      ),
      this.sanity.watchQuery<PostListItem[]>(allPostsQuery, {}, (data) => this.posts.set(data)),
    )
  }

  ngOnDestroy(): void {
    for (const unsub of this.unsubs) unsub()
  }

  coverUrl(post: PostListItem): string | undefined {
    return this.images.url(post.coverImage, 640)
  }
  logoUrl(settings: SiteSettings | null | undefined): string | undefined {
    return this.images.url(settings?.logo, 100)
  }
}
