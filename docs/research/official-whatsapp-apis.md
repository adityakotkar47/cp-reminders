# Official WhatsApp APIs

No official Meta API can post into a Community's Announcements group, or into any group created by a person in the WhatsApp app. Statements marked *(vendor)* come from third parties rather than Meta.

## Cloud API Groups API

The Groups API covers only groups that the API number creates itself.

| Aspect | Rule | Source |
|---|---|---|
| Eligibility | Official Business Account (OBA) only: "To qualify for groups features, your business must be an Official Business Account". Not available for WhatsApp Business app numbers or numbers on Multi-solution Conversations. | [Groups API](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/) |
| Size | At most 8 participants per group, 10,000 groups per number, one Cloud API business per group. The creating number takes one of the 8 places *(vendor: [Unipile](https://www.unipile.com/whatsapp-group-api/))*. | [Groups API](https://developers.facebook.com/docs/whatsapp/cloud-api/groups) |
| Membership | Invite-only: "participants join using a group invite link you send them", optionally through join requests the business approves. There is no endpoint to add a participant. | [Groups reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/reference.md) |
| Roles | "The business phone number used to create the group is always added to the group as the creator and admin." There is no endpoint to promote admins or make a group admin-only. | [Groups reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/reference.md) |
| Endpoints | Create and list groups, read and update group info, get or reset the invite link, manage join requests, remove participants, delete the group. | [Groups reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/reference.md) |
| Messages | Text, media and text or media templates. Not supported: calling, disappearing and view-once messages, authentication templates, commerce and interactive messages, editing and deleting messages. | [Groups API](https://developers.facebook.com/docs/whatsapp/cloud-api/groups) |
| Communities | Not mentioned anywhere in the Groups documentation, nor is joining a group created by someone else. | [Groups API](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/), [reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/reference.md) |

OBA requires compliance with the Business Messaging Policy, at least 30 days on the platform, a business portfolio passed through Business Verification, two-step verification and an approved display name; it is not granted to "business employees, test accounts, and WhatsApp Business app phone numbers" ([OBA](https://developers.facebook.com/documentation/business-messaging/whatsapp/official-business-accounts.md)). One vendor additionally requires a limit of 100,000 business-initiated conversations a day *(vendor: [WOZTELL](https://support.woztell.com/portal/en/kb/articles/the-first-guide))*; Meta's page does not.

Consequences for a user-created Community: the API cannot join it, groups the API creates are too small for a community, and an individual running a hobby community is unlikely to qualify for OBA.

## Coexistence

Coexistence onboards an existing WhatsApp Business **app** number to the Cloud API through a Tech Provider's Embedded Signup, and the app keeps working. Under coexistence ([onboarding Business app users](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users.md)):

- "Group chats will not be synchronized."
- Channels, broadcast lists, calls, live location, and disappearing and view-once messages are not supported; throughput is 20 messages a second.
- Messages sent from the app stay free; API messages are billed.
- Companion devices are unlinked.

The Groups API excludes Business app numbers, so a coexistence number automates only one-to-one chats *(vendor: [WATI](https://www.wati.io/en/blog/whatsapp-coexistence-solution/), [360dialog](https://docs.360dialog.com/docs/hub/embedded-signup/whatsapp-coexistence))*. Meta's page does not list eligible countries.

## Channels

Meta has no API for posting to a WhatsApp Channel. Its only Channel API is the read-only research Content Library ([Content Library guide](https://developers.facebook.com/docs/content-library-and-api/content-library-api/guides/wa-channel-update)). Channels are one-way: admins post, followers react and vote in polls, and updates expire after 30 days *(vendor: [Infobip](https://www.infobip.com/blog/how-to-use-whatsapp-channels-for-your-business))*. Third-party Channel posting APIs work by linking a personal account like WhatsApp Web *(vendor: [Whapi.Cloud](https://whapi.cloud/ru/how-to-automate-whatsapp-channels-api), [Z-API](https://developer.z-api.io/en/newsletter/introduction))*, which is an unofficial client.

## Messaging windows and templates in groups

- "When any WhatsApp user in the group messages you, a customer service window is opened between you and the entire group"; otherwise the 1:1 window rules apply ([group pricing](https://developers.facebook.com/docs/whatsapp/cloud-api/groups/pricing)).
- The window lasts 24 hours from the user's last message or call; outside it only templates can be sent ([pricing](https://developers.facebook.com/docs/whatsapp/pricing)).
- Group messages are billed as `group_marketing`, `group_utility` or `group_service`; templates in groups get no performance metrics ([group pricing](https://developers.facebook.com/docs/whatsapp/cloud-api/groups/pricing), [Groups API](https://developers.facebook.com/docs/whatsapp/cloud-api/groups)).

A scheduled reminder that no member prompted would need an approved utility or marketing template; Meta decides the category.

## Pricing

- Meta charges per delivered message, by category and recipient country ([pricing](https://developers.facebook.com/docs/whatsapp/pricing)).
- Each business number has a free tier of 1,000 delivered service messages a month; utility templates are charged inside an open window as well ([pricing](https://developers.facebook.com/docs/whatsapp/pricing)).
- A group message is charged once per delivered recipient, at that recipient's one-to-one rate; each group send consumes one free-tier unit per recipient; group utility messages get no volume tiers ([group pricing](https://developers.facebook.com/docs/whatsapp/cloud-api/groups/pricing)).
- India: billing in INR; eligible accounts must move to INR billing by 31 December 2026 ([pricing](https://developers.facebook.com/docs/whatsapp/pricing)). Rates before 18% GST are about ₹0.86 per marketing message and about ₹0.115 per utility message *(vendor: [ChatMaxima](https://chatmaxima.com/whatsapp-api-pricing/india/), [whautomate](https://whautomate.com/whatsapp-business-api-pricing-india))*; Meta's own rate card for India is a downloadable file.

## Terms for personal and Business app accounts

- The Terms prohibit "bulk messaging, auto-messaging, auto-dialing, and the like", "any non-personal use of our Services unless otherwise authorized by us", and accounts created "through unauthorized or automated means"; WhatsApp may disable or suspend accounts ([Terms](https://www.whatsapp.com/legal/terms-of-service)).
- "Linking your WhatsApp account to unofficial versions of WhatsApp violates our Terms of Service", and the account "might also be temporarily or permanently banned" ([FAQ: unofficial apps](https://faq.whatsapp.com/1217634902127718/?locale=en_US)).
- WhatsApp is "not intended for bulk or automated messaging", uses machine-learning classifiers to ban accounts, and takes legal action based on on-platform and off-platform evidence ([FAQ: automated messaging](https://faq.whatsapp.com/5957850900902049/?locale=en_US)).
- WhatsApp's third-party AI agents, linked by API key, cannot be added to groups or communities *(press: [WABetaInfo](https://wabetainfo.com/whatsapp-is-rolling-out-chats-with-third-party-agents/))*; the FAQ distinguishes this supported feature from unofficial apps.

Meta publishes no thresholds or statistics on bans for low-volume automation.

## Communities

- "Anyone can create a WhatsApp community", and "community admins can reach members with important updates by sending announcements" ([FAQ: about communities](https://faq.whatsapp.com/495856382464992/?locale=en_US)).
- Only community admins can send messages to the Announcements group *(vendor: [AiSensy](https://m.aisensy.com/blog/whatsapp-community/))*.
- Published size limits differ between sources, from 2,000 members and 100 groups to 5,000 members and 50 groups per community *(vendor: [Kanal](https://getkanal.com/blog/community-guide-whatsapp), [SetSmart](https://setsmart.io/blog/whatsapp-communities))*.

The only official way to post into a Community's Announcements group is from an admin's WhatsApp app.

## Not documented by Meta

- An explicit statement that Cloud API numbers cannot join Communities; the documentation is silent.
- Whether an individual or an unregistered group can obtain OBA.
- Whether coexistence is available in India.
- That Channels have no posting API; the conclusion rests on the developer documentation listing none.
