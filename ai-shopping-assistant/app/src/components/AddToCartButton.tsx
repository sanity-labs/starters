'use client'

import {ShoppingBag} from 'lucide-react'

import {Button} from '@/components/ui/button'

interface AddToCartButtonProps {
  disabled?: boolean
}

export function AddToCartButton({disabled}: AddToCartButtonProps) {
  return (
    <Button disabled={disabled} size="lg" className="w-full">
      <ShoppingBag className="h-4 w-4" />
      Add to Cart
    </Button>
  )
}
