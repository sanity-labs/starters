// Upstream defect: @sanity/workflow-components@0.23.0 declares `"types": "./dist/index.d.ts"` but ships no .d.ts files.
// This is what blocks adopting its `ProgressBar`/`clampProgress`/`progressCaption` in place of our own percentage rendering.
declare module '@sanity/workflow-components' {
  /** The one type `@sanity/workflow-sdk` re-exports, from `useProjectMembers`. */
  export interface ProjectMembersState {
    members: Array<{
      id: string
      displayName: string
      email?: string
      imageUrl?: string
      roles: string[]
    }>
    loading: boolean
    error: string | undefined
  }
}
