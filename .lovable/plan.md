# Approve = publish, instantly and publicly

Right now approving a video only marks it "scheduled" and it waits for the hourly worker. This change makes approval the single action that puts a video on YouTube immediately, visible to everyone.

## What changes for you

- Tap **Approve** on a finished video and it uploads to that channel's linked YouTube channel right away — no scheduling step.
- Uploads go up **public**, so viewers can watch them immediately.
- If the upload fails (channel not connected, YouTube error), the video shows the failure reason and stays approved so you can retry.
- Removing approval still pulls a not-yet-published video back out of the queue.
- The existing hourly worker stays as a safety net for anything that didn't go through on the first try.

## Also in this change

- Flip the already-published Outsourced Empire video ("Solo Founder Makes $42,000/Mo Never Cleaning a Single House") from private to public on YouTube.

## Technical notes

- `setVideoApproval` (src/lib/console.functions.ts): on approve, set the matching `publish_queue` row to `scheduled` with `scheduled_for = now()`, then invoke the publish path immediately inside the handler and return the resulting YouTube URL or the error message.
- Same behaviour for the ChatGPT/MCP path in `setVideoApprovalForUser` (src/lib/chatgpt-actions.server.ts), so approvals from the assistant publish too.
- `publishQueueItem` / `publishTick` (src/lib/publish.server.ts) default privacy changes from `private` to `public`; `uploadToYouTube` already takes the privacy argument.
- Approval-triggered publishing is wrapped so a failure never throws past the approval write — the queue row records `last_error` and the UI surfaces a toast.
- UI: Channels detail and Studio approve buttons show a publishing state and success/error toast; queue list already reflects status via existing queries.
- Visibility fix for the live video uses `setYouTubePrivacy(channelId, 'pbvCzzccYOI', 'public')` through an authenticated run, after which I confirm the video's status reads public.
