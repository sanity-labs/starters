# Beacon SMS Sender Registration Primer

| Field          | Value                                                                          |
| -------------- | ------------------------------------------------------------------------------ |
| Doc ID         | CS-SMS-2025-08                                                                 |
| Version        | v1.1                                                                           |
| Owner          | Channels                                                                       |
| Document owner | Channels Product Team                                                          |
| Last reviewed  | 2024-11-19                                                                     |
| Classification | Customer                                                                       |
| Related        | Deliverability Guide (CS-DEL-2026-02), Acceptable Use Policy (SEC-AUP-2025-11) |

> This primer was last reviewed in November 2024. Registration requirements and plan availability change. Confirm your plan's channels in Administration → Billing before relying on section 7.

## Why registration exists

Carriers filter unregistered bulk SMS aggressively. Registration tells the carrier who you are, what you send, and how recipients opted in, so that legitimate traffic gets through and unregistered traffic does not. Registration is not optional for business messaging at volume; unregistered traffic is throttled, filtered, or blocked outright, and the sender has no visibility into which.

Beacon handles the technical side of registration and submits on your behalf. You supply the business information and the messaging use case.

## Sender types

Beacon supports three kinds of SMS sender. Which one you need depends on volume and market.

| Sender type          | Best for                                  | Throughput                      | Registration                                |
| -------------------- | ----------------------------------------- | ------------------------------- | ------------------------------------------- |
| Standard long number | Low-volume, conversational, transactional | Low; carrier-limited per number | Business profile plus campaign registration |
| Toll-free number     | Mid-volume marketing and alerts           | Medium                          | Toll-free verification                      |
| Short code           | High-volume marketing                     | High                            | Dedicated application; 8 to 12 weeks        |

Most Beacon customers begin with a standard long number registered for business messaging, then add a toll-free number as volume grows. Short codes are worth it above roughly one million messages per month or when you need a memorable number for keyword opt-ins.

## What you need to register

Beacon collects the following in Channels → SMS → Sender registration. Have it ready before you start; incomplete submissions are the main cause of delay.

1. **Legal business name and registration number.** The name must match your registration documents exactly. Trading names do not pass.
2. **Business address and website.** The website must be live and must describe the business that is sending.
3. **A contact person** with a work email at your domain.
4. **Use case.** Marketing, account notifications, two-factor codes, customer care, or mixed. Pick the one that matches what you will actually send. Mixed use cases receive lower throughput.
5. **Sample messages.** Two or three examples that show your brand name and how the recipient opts out.
6. **Opt-in description.** How a contact agrees to receive SMS from you: web form, keyword, point of sale, and so on. Attach a screenshot of the form or the keyword prompt.
7. **Estimated monthly volume.**

## The registration process

1. Submit the form in Channels → SMS → Sender registration. Beacon validates it for obvious errors immediately.
2. Beacon files the business profile with the registry. Vetting usually takes one to three business days.
3. Beacon files the campaign registration against the approved profile. This takes another one to three business days for standard use cases, longer for regulated categories.
4. The sender shows **Registered** in Channels → SMS. Throughput and per-day limits appear next to the number.
5. Send a small test to your own devices before your first campaign.

Beacon emails your workspace Admins at each stage. A rejection includes the registry's reason. The most common reasons are a name that does not match registration documents, a website that does not mention SMS, and sample messages that lack an opt-out instruction.

## Message requirements

Once registered, every message you send should:

- Identify your brand. "Northwind: your order has shipped" rather than "Your order has shipped."
- Include opt-out instructions in the first message to a contact and periodically after. Beacon appends "Reply STOP to opt out" automatically to marketing campaigns unless your template already includes it.
- Match the registered use case. A sender registered for account notifications that starts sending promotions will be flagged.
- Avoid public link shorteners. Carriers filter them. Beacon can provide branded short links; ask Support.
- Stay inside quiet hours. Beacon's default SMS quiet hours are 21:00 to 09:00 in the recipient's local time, based on the contact's time zone field. Admins can narrow this window but cannot widen it for marketing traffic.

## Opt-out and STOP handling

Beacon processes STOP, UNSUBSCRIBE, CANCEL, END, and QUIT replies automatically. The contact is suppressed for SMS on the sending number and receives a single confirmation. Beacon also processes HELP by replying with your registered contact information.

You cannot disable STOP handling. If a contact replies STOP by mistake, they can resubscribe by texting START or by opting in again through your form. Support cannot remove the suppression for you.

## Consent

SMS consent is stricter than email consent and is enforced at the carrier level as well as by Beacon. Keep a record of when, where, and how each contact opted in. Import that as the SMS consent field. Contacts without SMS consent cannot be targeted by SMS campaigns.

A contact who gave you an email address has not given you permission to text them. Ask separately.

## Plan availability

SMS is available on the following products.

| Product                    | SMS included             |
| -------------------------- | ------------------------ |
| Campaigns (Growth)         | Yes                      |
| Channels (Growth)          | Yes                      |
| Workflows (Growth)         | Yes                      |
| Developer API (Enterprise) | Yes                      |
| Analytics (Enterprise)     | Reporting only           |
| Segments (Starter)         | Yes, with the SMS add-on |

Carrier pass-through fees are billed as usage and are not refundable. See the Billing and Refund Policy.

## Troubleshooting

**Messages show Delivered but recipients do not see them.** Filtering after acceptance. Check that the sender is registered and the content matches the use case. Unregistered traffic is the usual cause.

**High undelivered rate to one carrier.** Often a content filter on that carrier. Remove shortened links and check for words associated with prohibited categories.

**Registration stuck at Pending for more than five business days.** Contact Support with the sender ID. Beacon can query the registry directly.

## Revision history

| Version | Date       | Change                                        |
| ------- | ---------- | --------------------------------------------- |
| v1.0    | 2024-03-05 | Initial primer                                |
| v1.1    | 2024-11-19 | Added quiet hours and plan availability table |
