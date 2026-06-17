# External Widget Embed Checklist

The customer widget remains public/customer-scoped. It must not use Clerk, admin tokens, OpenAI keys, or debug APIs.

## Current Embed Method

Until a universal hosted one-line embed bundle is validated online, use the built customer widget artifact from the deployed customer-widget app or a manually hosted bundle. The embed page must provide:

- tenant slug
- API base URL
- stable visitor identity
- optional theme values

Example shape:

```html
<div id="ai-support-widget"></div>
<script src="https://<widget-host>/widget.js"></script>
<script>
  window.PlatformCustomerWidget.mount("#ai-support-widget", {
    tenantSlug: "<tenant-slug>",
    apiBaseUrl: "https://<api-host>/v1",
    visitorId: window.localStorage.getItem("alphaVisitorId") || crypto.randomUUID()
  });
</script>
```

Only use public tenant/widget values in the browser. Do not include admin API tokens, Clerk secret keys, OpenAI keys, database URLs, or raw debug metadata.

## CORS / Domain Setup

Configure the API to allow the external test origin used by the widget page. The allowed origin should be the exact scheme + host + port where practical.

## Manual Smoke

1. Open the external test page/domain.
2. Confirm the widget loads without admin credentials.
3. Confirm visitor identity persists across refresh.
4. Send a knowledge-backed question.
5. Confirm the AI answer and citations appear.
6. Send a knowledge-miss question.
7. Confirm no hallucinated citation is shown.
8. Request handoff.
9. Sign in to admin/agent through Clerk.
10. Send an agent reply.
11. Confirm the customer sees the intended agent reply.
12. Refresh the external page and confirm conversation restore still works for the same visitor.
