import {BrowsePanel} from './BrowsePanel'
import {ChatPanel} from './ChatPanel'

// Two-panel internal tool: browse internal content on the left, ask the
// everything-aware agent on the right.
export function Dashboard() {
  return (
    <div style={{display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif'}}>
      <div style={{flex: 1, borderRight: '1px solid #e5e7eb', overflow: 'auto'}}>
        <BrowsePanel />
      </div>
      <div style={{flex: 1, overflow: 'auto'}}>
        <ChatPanel />
      </div>
    </div>
  )
}
