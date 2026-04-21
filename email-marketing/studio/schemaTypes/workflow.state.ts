import {defineField, defineType} from 'sanity'

export const workflowState = defineType({
  name: 'workflow.state',
  title: 'Workflow State',
  type: 'document',
  fields: [
    defineField({
      name: 'promotionId',
      title: 'Promotion ID',
      type: 'reference',
      to: [{type: 'promotion'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'status',
      title: 'Approval Status',
      type: 'string',
      options: {
        list: [
          {title: 'Draft', value: 'draft'},
          {title: 'In Review', value: 'in-review'},
          {title: 'Approved', value: 'approved'},
          {title: 'Sent', value: 'sent'},
          {title: 'Rejected', value: 'rejected'},
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'approvedBy',
      title: 'Approved By',
      type: 'string',
      description: 'User who approved the promotion',
    }),
    defineField({
      name: 'approvalNotes',
      title: 'Approval Notes',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'sentAt',
      title: 'Sent At',
      type: 'datetime',
      description: 'Timestamp when promotion was sent',
    }),
    defineField({
      name: 'history',
      title: 'Status History',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            {name: 'status', type: 'string', title: 'Status'},
            {name: 'timestamp', type: 'datetime', title: 'Timestamp'},
            {name: 'changedBy', type: 'string', title: 'Changed By'},
          ],
        },
      ],
      description: 'Audit trail of status changes',
    }),
  ],
  preview: {
    select: {
      promotionId: 'promotionId',
      status: 'status',
    },
    prepare: ({promotionId, status}) => ({
      title: `${promotionId} — ${status}`,
      subtitle: 'Workflow State',
    }),
  },
})
