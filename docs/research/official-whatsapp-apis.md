# Official Meta/WhatsApp APIs for posting into a WhatsApp Community's "Announcements" group (as of Nov 2026)

Research date: 2026-11-07. "Confirmed (docs)" = stated on a Meta/WhatsApp page I fetched. "Inferred" = my reasoning from those pages. Third-party vendor blogs are labelled as such.

**Bottom line:** No official Meta API, as of November 2026, can post into a Community's built-in Announcements group, or into any group that a normal user created. The Cloud API Groups API only works with groups that the API number creates itself. Those groups hold at most 8 participants, people join only through an invite link, and the business needs an Official Business Account (OBA). Meta's docs never mention Communities. No official API was found for posting to WhatsApp Channels. Automating a personal or Business-app account breaks WhatsApp's Terms and can lead to a ban.

---

## Q1. WhatsApp Business Platform / Cloud API: does a Groups API exist, and what does it support?

### Takeaway
Yes, a Cloud API "Groups API" exists and is documented. It is very narrow. It works only with groups the business number creates, which hold at most 8 participants including the business. Members can join only through an invite link, and the business needs OBA status. Nothing in the docs supports Communities, announcement groups, or joining a group someone else made, so it cannot do what this student needs.

### Cited Findings
- **Eligibility (confirmed, docs):** "The Groups API is now open to all businesses with an Official Business Account (OBA)." and "To qualify for groups features, your business must be an Official Business Account (OBA)." — [Meta Groups API docs](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/) (also at [legacy URL](https://developers.facebook.com/docs/whatsapp/cloud-api/groups))
- **Exclusions (confirmed, docs):** "Groups are not available for WhatsApp Business app phone numbers". Numbers onboarded to Multi-solution Conversations are also excluded. — [Meta Groups API docs](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/)
- **Limits (confirmed, docs):**
  - Max 8 group participants.
  - Max 10,000 groups per business number.
  - "Max Cloud API businesses per group: 1".
  - Source: [Meta Groups API docs](https://developers.facebook.com/docs/whatsapp/cloud-api/groups)
  - A vendor guide adds that the creating business number uses one of the 8 slots: [Unipile](https://www.unipile.com/whatsapp-group-api/) (third-party).
- **Joining (confirmed, docs):** "Groups are an invite-only experience where participants join using a group invite link you send them." There is no endpoint to add participants directly. Users join through the link, optionally via join requests that the business approves or rejects. — [Meta Groups API docs](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/); [Groups reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/reference.md)
- **Endpoints (confirmed, docs):**
  - `POST /<PHONE_NUMBER_ID>/groups` (create a group).
  - `GET`/`POST /<GROUP_ID>/invite_link` (get or reset the invite link).
  - Invite-link template message sent via `/messages`.
  - `GET`/`POST`/`DELETE /<GROUP_ID>/join_requests`.
  - `DELETE /<GROUP_ID>/participants` (max 8 per request).
  - `DELETE /<GROUP_ID>` (delete the group).
  - `GET /<GROUP_ID>?fields=` (group info).
  - `GET /<PHONE_NUMBER_ID>/groups` (active groups).
  - `POST /<GROUP_ID>` (subject, description, photo).
  - Source: [Groups reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/reference.md)
- **Admin role (confirmed, docs):** "The business phone number used to create the group is always added to the group as the creator and admin." No endpoint was found for promoting admins or for setting "only admins can send". — [Groups reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/reference.md)
- **Supported messages (confirmed, docs):** text, media, text-based templates, media-based templates.
  - Not supported: calling, disappearing messages, view-once, authentication templates, commerce messages, interactive messages.
  - Also not supported: hiding the participant list, editing messages, deleting messages.
  - Source: [Meta Groups API docs](https://developers.facebook.com/docs/whatsapp/cloud-api/groups)
- **Communities and announcement groups:** Neither the Groups overview nor the reference mentions Communities, announcement groups, or joining existing user-created groups. — [Groups overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/); [Groups reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/reference.md)
- **Launch date:** No dated Meta press release for the Groups API was found. The docs page was reportedly dated June 16, 2026 (per search snippet). Meta's Conversations 2025 event (Miami, July 1, 2025) announced calling, AI, and campaign tools. Group messaging appears there only in vendor coverage. — [The Week](https://www.theweek.in/news/sci-tech/2025/07/03/meta-gives-whats-app-a-business-makeover-with-ai-calls-and-cross-platform-ad-tools.amp.html); [Omnichat blog](https://blog.omnichat.ai/whatsapp-groups-api/) (third-party)
- **Conflicting eligibility detail:** WOZTELL (a vendor) says OBA *plus* a messaging limit of 100K business-initiated conversations per 24h is required. Meta's current page lists only OBA. — [WOZTELL](https://support.woztell.com/portal/en/kb/articles/the-first-guide), contradicted by [Meta docs](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/)
  - This 100K figure is likely an earlier beta-era requirement.
- **OBA criteria (confirmed, docs):** all of the following must hold:
  - Compliance with the Business Messaging Policy.
  - "registered on the WhatsApp Business Platform for at least 30 days".
  - Business portfolio verified via Business Verification.
  - Two-step verification enabled.
  - Display name approved.
  - Also: OBA is not granted to "business employees, test accounts, and WhatsApp Business app phone numbers."
  - Source: [Meta OBA docs](https://developers.facebook.com/documentation/business-messaging/whatsapp/official-business-accounts.md)
  - The current page lists no notability or press-coverage requirement. Older OBA guidance was widely reported to need "notable brand" evidence, but I did not verify that here.

### Inferences
- **No route into the Announcements group:** A Community's Announcements group is created by a normal WhatsApp user, and the API cannot join or be added to such groups. So no confirmed Cloud API path exists to post into it.
- **Groups are too small:** API-created groups cap at 8 participants. A replacement "API group" therefore cannot serve a CP community of tens to hundreds of members.
- **Communities are probably off-limits:** No documented way exists to link an API-created group into a Community. Communities are a consumer and Business-app feature, while API numbers cannot use the app.
- **OBA is hard for a student:** OBA requires a verified business portfolio and Business Verification. An individual student running a hobby community will likely struggle to qualify, but that is not confirmed.

### Gaps
- No Meta statement explicitly says "Cloud API numbers cannot join Communities". The docs are silent, so this is inferred.
- No dated official launch announcement for the Groups API was found.
- Whether OBA can be obtained by an individual or a non-registered group: the docs do not address it.

---

## Q2. Can a Cloud API number also be used in the normal WhatsApp app? (Coexistence)

### Takeaway
Normally a number registered on the Cloud API cannot be used in the consumer or Business app. The one exception is "Coexistence": an existing WhatsApp Business **app** number is onboarded to the Cloud API through a Tech Provider's Embedded Signup, and the app keeps working. Coexistence does not sync group chats, does not support channels, and the Groups API excludes Business-app numbers. So coexistence does not enable API posting into a Community.

### Cited Findings
- **How coexistence works (confirmed, docs):**
  - Coexistence lets business customers "onboard using their existing WhatsApp Business app account and phone number" to the Cloud API.
  - Requirements: Business app v2.24.17+, onboarding through a Solution Partner/Tech Provider's Embedded Signup, and a webhook.
  - Source: [Meta: Onboarding Business app users](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users.md)
- **Not supported under coexistence (confirmed, docs):**
  - "Group chats will not be synchronized."
  - Broadcast lists are disabled (existing lists become read-only).
  - Disappearing and view-once messages are not supported.
  - Live location is disabled.
  - Calls, business tools, messaging tools, and **channels** are not supported.
  - Throughput is fixed at 20 mps.
  - Source: [Meta: Onboarding Business app users](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users.md)
- **Communities:** not mentioned on that page. — [same](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users.md)
- **Pricing and companion apps (confirmed, docs):**
  - Messages sent from the Business app stay free: "messages sent by the business via the WhatsApp Business app will continue to be free".
  - API messages are billed.
  - Onboarding unlinks companion devices.
  - Source: [same](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users.md)
- **Vendor docs agree:**
  - Groups stay app-only, and API automation applies only to 1:1 chats.
  - The Groups API is "not available to Coexistence numbers".
  - Newly created Business app accounts are not immediately eligible.
  - Sources: [WATI](https://www.wati.io/en/blog/whatsapp-coexistence-solution/), [360dialog](https://docs.360dialog.com/docs/hub/embedded-signup/whatsapp-coexistence) (third-party)
- **Groups API exclusion (confirmed, docs):** "Groups are not available for WhatsApp Business app phone numbers". — [Meta Groups API docs](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/)

### Inferences
- If the student's admin number were a WhatsApp Business app number onboarded via coexistence, they could keep posting manually in the Community from the app. The API side, however, could only send 1:1 messages, not group or Community messages.
- Coexistence requires going through a Tech Provider (BSP) Embedded Signup flow. That often involves the BSP's fees, so it is probably not free.

### Gaps
- Meta's coexistence page does not list eligible countries, so India eligibility was not confirmed from Meta. Vendor sources imply broad availability.

---

## Q3. WhatsApp Channels: is there an official API to post?

### Takeaway
No official Meta API for posting to a WhatsApp Channel was found. The only Meta developer API touching Channels is the read-only Meta Content Library research API. Channels are one-way broadcast feeds where only admins post. They would make a reasonable *manual* alternative to an announcements group, but they offer no official automation.

### Cited Findings
- **Content Library API only:** The only developers.facebook.com result for Channels is the Meta Content Library API guide. It reads channel updates (`/whatsapp/channels/{mcl_id}/updates/preview`) and is a research-data API, not a publishing API. — [Meta Content Library: WA channel update guide](https://developers.facebook.com/docs/content-library-and-api/content-library-api/guides/wa-channel-update)
- **No Channel support under coexistence (confirmed, docs):** Coexistence does not support channels. — [Meta: Onboarding Business app users](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users.md)
- **How Channels work:** They are one-way. Admins post, and followers can react and vote in polls but cannot reply. Updates expire after 30 days. — [Infobip](https://www.infobip.com/blog/how-to-use-whatsapp-channels-for-your-business); [WATI](https://www.wati.io/en/blog/whatsapp-channels/) (third-party)
- **Unofficial channel posting:** Third-party "newsletter" posting APIs exist (Whapi.Cloud, Z-API). They work by linking a personal account through QR code / WhatsApp Web, which is an *unofficial* route. — [Whapi.Cloud](https://whapi.cloud/ru/how-to-automate-whatsapp-channels-api); [Z-API](https://developer.z-api.io/en/newsletter/introduction)
  - WhatsApp says linking an account to unofficial versions "violates our Terms of Service". — [WhatsApp FAQ: unofficial apps](https://faq.whatsapp.com/1217634902127718/?locale=en_US)

### Inferences
- A Channel would separate reminders cleanly from the sub-groups, since only Channel followers receive them. Without an official API, though, posting stays manual or unofficial and carries ban risk.
- Channel notifications are typically muted by default for followers, which makes them less noticeable than a Community announcement. This comes from general product knowledge and was not verified in this session.

### Gaps
- I could not find an official faq.whatsapp.com statement that "there is no Channels API". The absence is inferred from the developer docs.

---

## Q4. Do template / 24-hour customer-service-window rules apply to group messages?

### Takeaway
Yes, in a modified form. Groups use the same per-message pricing and category system as 1:1 messaging. When *any* group member messages the business, a customer-service window opens for the whole group. Outside that window the business must send templates (marketing or utility). Authentication templates are not supported in groups.

### Cited Findings
- **Group-wide window (confirmed, docs):** "When any WhatsApp user in the group messages you, a customer service window is opened between you and the entire group." and "Everything else about customer service windows remains the same" as in 1:1 messaging. — [Meta Groups pricing](https://developers.facebook.com/docs/whatsapp/cloud-api/groups/pricing)
- **24-hour window and template rule (confirmed, docs):** The general window is 24 hours from the user's last message or call. Outside it, only templates can be sent. — [Meta pricing docs](https://developers.facebook.com/docs/whatsapp/pricing)
- **Group billing categories (confirmed, docs):** `group_marketing`, `group_utility`, `group_service`. — [Meta Groups pricing](https://developers.facebook.com/docs/whatsapp/cloud-api/groups/pricing)
- **Templates (confirmed, docs):** Templates used in Groups get no performance metrics, and Meta advises creating Groups-specific templates. — [Meta Groups API docs](https://developers.facebook.com/docs/whatsapp/cloud-api/groups)

### Inferences
- A weekly contest reminder sent with no member messaging first would need an approved template. It would likely be a utility or marketing template; Meta decides the category, and contest reminders might be classed as marketing.

### Gaps
- None material.

---

## Q5. Cost: per-message pricing and India rates

### Takeaway
Meta has charged per delivered message since July 1, 2025. From October 1, 2026, service messages are free only up to 1,000 per number per month, and utility messages are charged even inside an open window. Group messages are billed **per delivered recipient** at the 1:1 rates. In India (unofficial rate cards, pre-GST), that is roughly ₹0.86 per marketing message and roughly ₹0.115 per utility message, per recipient.

### Cited Findings
- **Per-message model (confirmed, docs):** Per-message pricing has applied since July 1, 2025. Charges are made only on delivery and vary by category and recipient country code. — [Meta pricing docs](https://developers.facebook.com/docs/whatsapp/pricing)
- **October 1, 2026 changes (confirmed, docs):**
  - Service messages were free from Nov 1, 2024 to Sep 30, 2026. From Oct 1, 2026: "Each business phone number has one free tier of 1,000 delivered service messages per month". Charging starts at the 1,001st, and unused messages do not roll over.
  - Utility templates inside an open window were free from July 1, 2025 and are charged from Oct 1, 2026.
  - Source: [Meta pricing docs](https://developers.facebook.com/docs/whatsapp/pricing)
- **Group billing (confirmed, docs):**
  - "you are charged each time a billable message is delivered to someone in the group". Example: a marketing template delivered to 5 members is 5 charges.
  - Each recipient is billed at their country's rate.
  - `group_service` (non-template) messages are free only within the shared 1,000/month free tier from Oct 1, 2026. "each group send consumes one unit per delivered recipient."
  - "Group utility messages are not eligible for volume tiers."
  - Rates are "the same as per-messaging pricing rates for 1 to 1 messaging."
  - Source: [Meta Groups pricing](https://developers.facebook.com/docs/whatsapp/cloud-api/groups/pricing)
- **India-specific (confirmed, docs):**
  - Marketing rates for India rose on Jan 1, 2026.
  - INR billing launched Jan 1, 2026.
  - Eligible India accounts must migrate to INR by Dec 31, 2026, or non-INR accounts stop delivering from Jan 1, 2027.
  - Source: [Meta pricing docs](https://developers.facebook.com/docs/whatsapp/pricing)
- **India rate figures (third-party, not Meta's rate card):**
  - Marketing: about ₹0.8631/msg, up from about ₹0.7846 before Jan 2026. — [whautomate](https://whautomate.com/whatsapp-business-api-pricing-india); [ChatMaxima](https://chatmaxima.com/whatsapp-api-pricing/india/)
  - Utility/authentication: about ₹0.115/msg. — [ChatMaxima](https://chatmaxima.com/whatsapp-api-pricing/india/)
  - Other vendors quote ₹0.11–0.16 for utility. — [Robylon](https://www.robylon.ai/blog/whatsapp-business-api-pricing-india)
  - Rates exclude 18% GST. — [ChatMaxima](https://chatmaxima.com/whatsapp-api-pricing/india/)
- **Free entry point (confirmed, docs):** A free entry point window (up to 7 days, all categories free) opens only from Click-to-WhatsApp ads. — [Meta pricing docs](https://developers.facebook.com/docs/whatsapp/pricing)
  - Inferred: this is not relevant to this use case.

### Inferences
- **Cost sketch (moot here):** A hypothetical API group could hold at most 7 members besides the business number. A utility reminder to 7 Indian members would cost about 7 × ₹0.115 ≈ ₹0.8 + GST per send. Marketing would cost about 7 × ₹0.86 ≈ ₹6. This is moot, because such groups cannot reach the Community.
- **Free tier and setup:** Non-template group messages could be "free" under the 1,000/month tier only when a member has messaged the group within the last 24h. The OBA requirement also makes the setup itself non-trivial.

### Gaps
- Meta's official India rate-card numbers (CSV/PDF) were not fetched. The figures above come from third parties.

---

## Q6. Meta Terms on automating personal / WhatsApp Business app accounts

### Takeaway
WhatsApp's Terms prohibit bulk and auto-messaging, non-personal use without authorization, and unofficial clients. Meta enforces this with machine-learning bans and legal action. Automating the student's personal or Business-app account, for example with WhatsApp Web automation libraries, is against the Terms and carries temporary or permanent ban risk.

### Cited Findings
- **Terms of Service (confirmed, terms):** The Terms (effective Jan 4, 2021) prohibit "sending illegal or impermissible communications such as bulk messaging, auto-messaging, auto-dialing, and the like" and "any non-personal use of our Services unless otherwise authorized by us". They also prohibit creating accounts "through unauthorized or automated means". WhatsApp "may take action with respect to your account, including disabling or suspending your account." — [WhatsApp Terms of Service](https://www.whatsapp.com/legal/terms-of-service)
- **Unofficial apps (confirmed, FAQ):** "Using these apps or linking your WhatsApp account to unofficial versions of WhatsApp violates our Terms of Service". "Your WhatsApp account might also be temporarily or permanently banned." — [WhatsApp FAQ: unofficial apps](https://faq.whatsapp.com/1217634902127718/?locale=en_US)
- **Enforcement (confirmed, FAQ):**
  - WhatsApp products are "not intended for bulk or automated messaging".
  - Bans are issued via machine-learning classifiers.
  - WhatsApp takes legal action against those linked to on-platform evidence and, since Dec 7, 2019, also based on off-platform evidence, such as companies' public claims.
  - Also: "receiving many messages at once will not result in an account ban."
  - Source: [WhatsApp FAQ: unauthorized automated/bulk messaging](https://faq.whatsapp.com/5957850900902049/?locale=en_US)
- **Third-party AI agents (2026):** WhatsApp is rolling out "chats with third-party agents" in limited testing. Users link up to 5 external AI agents via an API key. These agents **cannot be added to groups or communities**. — [WABetaInfo](https://wabetainfo.com/whatsapp-is-rolling-out-chats-with-third-party-agents/); [iGeeksBlog](https://www.igeeksblog.com/whatsapp-third-party-ai-agents/) (press reports on beta)
  - WhatsApp's FAQ notes that "Connecting a third-party agent through WhatsApp's supported agent feature is different" from unofficial apps. — [WhatsApp FAQ: unofficial apps](https://faq.whatsapp.com/1217634902127718/?locale=en_US)

### Inferences
- A small, admin-authored weekly reminder is low-volume. Even so, automating a personal account through WhatsApp Web libraries (whatsapp-web.js, Baileys, etc.) uses an "unofficial" client and so violates the Terms whatever the volume. The actual ban risk for low-volume use is not documented by Meta.
- The new official third-party agent feature gives no route to Communities, since agents are reported as excluded from groups and communities.

### Gaps
- Meta publishes no thresholds or statistics on bans for low-volume personal automation.

---

## Supporting facts: Communities and the Announcements group

### Takeaway
A Community's Announcements group is admin-only. Official FAQ wording confirms that admins send announcements to the whole Community. The current size limits come only from third-party sources and conflict with one another.

### Cited Findings
- **Official FAQ (confirmed):** "Anyone can create a WhatsApp community." "Community admins can reach members with important updates by sending announcements." You can "create new topic-based groups or add existing WhatsApp groups." — [WhatsApp FAQ: About communities](https://faq.whatsapp.com/495856382464992/?locale=en_US)
- **Admin-only posting:** "Only community admins can send messages to the Announcement group". Leaving the Announcement group means leaving the Community. — [AiSensy](https://m.aisensy.com/blog/whatsapp-community/) (third-party)
- **Size limits (conflicting, third-party only):**
  - 2,000 members / 100 groups per Community (2026 sources, citing the Help Center) vs. older 5,000 members / 50 groups.
  - Regular groups: 1,024 members.
  - About 20 community admins.
  - Sources: [Kanal](https://getkanal.com/blog/community-guide-whatsapp); [SetSmart](https://setsmart.io/blog/whatsapp-communities)

### Inferences
- Only an admin of the Community can post announcements, and Cloud API numbers cannot operate inside user Communities. So the only *official* way to post there remains manual posting from an admin's WhatsApp app.

### Gaps
- I could not fetch the official "About community announcements" FAQ page or official limit numbers.
