import {inject, Injectable} from '@angular/core'
import imageUrlBuilder from '@sanity/image-url'
import {PUBLIC_ENV} from '../env/public-env.token'

type ImageSource = Parameters<ReturnType<typeof imageUrlBuilder>['image']>[0]

@Injectable({providedIn: 'root'})
export class SanityImageService {
  private readonly env = inject(PUBLIC_ENV)

  url(source: ImageSource | undefined, width = 1200): string | undefined {
    if (!source) return undefined
    return imageUrlBuilder({
      projectId: this.env.projectId,
      dataset: this.env.dataset,
    })
      .image(source)
      .width(width)
      .auto('format')
      .url()
  }
}
