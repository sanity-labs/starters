import React from 'react'

interface SanityImageObject {
  asset?: {_ref?: string}
}

interface SanityImageProps {
  alt?: string
  className?: string
  height?: number
  image: SanityImageObject
  style?: React.CSSProperties
  width?: number
}

function SanityImage({
  alt = 'Image',
  className = '',
  height = 40,
  image,
  style = {},
  width = 40,
}: SanityImageProps) {
  const getImageUrl = (imageData: SanityImageObject) => {
    if (!imageData?.asset?._ref) {
      return null
    }

    const projectId = import.meta.env.SANITY_APP_PROJECT_ID
    const dataset = import.meta.env.SANITY_APP_DATASET || 'production'

    // Extract the asset ID from the reference
    // Format: "image-17fc85bb342613564d22be98165117abd0c6ea41-5000x3340-jpg"
    const assetRef = imageData.asset._ref
    const assetId = assetRef.replace('image-', '')

    // The assetId now contains: "17fc85bb342613564d22be98165117abd0c6ea41-5000x3340-jpg"
    // We need to convert the format from "-jpg" to ".jpg"
    const finalAssetId = assetId
      .replace(/-jpg$/, '.jpg')
      .replace(/-png$/, '.png')
      .replace(/-webp$/, '.webp')

    return `https://cdn.sanity.io/images/${projectId}/${dataset}/${finalAssetId}?auto=format&w=${width}&h=${height}`
  }

  if (!image) {
    return null
  }

  const imageUrl = getImageUrl(image)

  if (!imageUrl) {
    return null
  }

  return (
    <img
      alt={alt}
      className={`shrink-0 rounded object-cover ${className ?? ''}`}
      onError={(e) => {
        console.error('SanityImage failed to load:', e)
        console.log('Image data:', image)
      }}
      src={imageUrl}
      style={{height: `${height}px`, width: `${width}px`, ...style}}
    />
  )
}

export default SanityImage
