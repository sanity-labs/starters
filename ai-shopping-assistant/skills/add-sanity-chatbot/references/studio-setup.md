# Studio Setup: Adding Agent Context to Your Existing Studio

Configure the Sanity Context plugin in your existing Studio to create agent context documents that scope what content the chatbot can access.

## 1. Install the Package

In your Studio project directory:

```bash
npm install @sanity/agent-context
```

**Version requirements:**

| Package                 | Version | Notes                     |
| ----------------------- | ------- | ------------------------- |
| `@sanity/agent-context` | latest  | Check npm for current     |
| `sanity`                | ^5.8.0  | Studio v5.1.0+            |

## 2. Add the Plugin to Your Config

Open your `sanity.config.ts` and add the plugin:

```ts
import {agentContextPlugin} from '@sanity/agent-context/studio'

export default defineConfig({
  // ... your existing config (name, projectId, dataset, etc.)
  plugins: [
    // ... your existing plugins
    agentContextPlugin(),
  ],
})
```

This registers the `sanity.agentContext` document type in your Studio.

### Full example with custom structure (optional)

If you want to organize agent-related documents under a dedicated section in the Studio:

```ts
import {defineConfig} from 'sanity'
import {structureTool, type StructureBuilder, type ListItemBuilder} from 'sanity/structure'
import {agentContextPlugin} from '@sanity/agent-context/studio'
// ... your other imports

// Types to group under the "Agents" section in the desk
const AGENT_TYPES = ['sanity.agentContext']

export default defineConfig({
  // ... your existing config
  plugins: [
    structureTool({
      structure: (S: StructureBuilder) => {
        // Filter agent types out of the default list
        const defaultItems = S.documentTypeListItems().filter(
          (item: ListItemBuilder) => !AGENT_TYPES.includes(item.getId() ?? ''),
        )

        // Build agent section items
        const agentItems = AGENT_TYPES.map((type) => S.documentTypeListItem(type))

        return S.list()
          .title('Content')
          .items([
            ...defaultItems,
            S.divider(),
            S.listItem().title('Agents').child(S.list().title('Agents').items(agentItems)),
          ])
      },
    }),
    agentContextPlugin(),
    // ... your other plugins
  ],
})
```

## 3. Create an Agent Context Document

Open your Studio and create a new **Agent Context** document. Fill in:

| Field              | Description                                               |
| ------------------ | --------------------------------------------------------- |
| **Name**           | Display name (e.g., "Product Assistant", "Site Chatbot")  |
| **Slug**           | URL-friendly identifier, auto-generated from name         |
| **Content Filter** | GROQ filter that scopes what content the agent can access |

### Content Filter Examples

**All documents of specific types:**

```groq
_type in ["article", "product", "category"]
```

**Published content only:**

```groq
_type in ["article", "product"] && !(_id in path("drafts.**"))
```

**Content in a specific language:**

```groq
_type == "article" && language == "en"
```

The filter UI provides two modes:

- **Types tab**: Simple checkbox UI to select document types
- **GROQ tab**: Manual entry for complex filters

**Tip:** Start broad (select all content types), then narrow based on what the chatbot actually needs.

## 4. Copy the MCP URL

Once the Agent Context document has a slug, the MCP URL appears at the top of the document form:

```
https://api.sanity.io/:apiVersion/agent-context/:projectId/:dataset/:slug
```

Copy this URL. You will use it as `SANITY_CONTEXT_MCP_URL` in your Next.js app's environment variables.

## 5. Publish the Document

The Agent Context document **must be published** for the MCP endpoint to work. Drafts are not accessible via the MCP URL.

## 6. Validate MCP Access (Optional)

Before building anything, verify the MCP endpoint is reachable:

```bash
curl -X POST https://api.sanity.io/vX/agent-context/YOUR_PROJECT_ID/YOUR_DATASET/YOUR_SLUG \
  -H "Authorization: Bearer $SANITY_API_READ_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
```

You should see a JSON response listing `initial_context`, `groq_query`, and `schema_explorer` tools.

## Next Steps

With Studio configured and the MCP URL copied, proceed to [chat-implementation.md](chat-implementation.md) to add the chatbot to your Next.js app.
