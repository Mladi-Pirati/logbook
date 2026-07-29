import { faker } from "@faker-js/faker"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { z } from "zod"

import * as schema from "@/db/schema"
import {
  boards,
  columns,
  helmDirectorySyncs,
  labels,
  projects,
  ticketAssignees,
  ticketComments,
  ticketLabels,
  tickets,
  users,
} from "@/db/schema"
import type { RichTextDocument } from "@/lib/rich-text"

const DATABASE_URL = z.string().min(1).parse(process.env.DATABASE_URL)

const client = postgres(DATABASE_URL, { max: 1 })
const db = drizzle(client, { schema, casing: "snake_case" })

const now = new Date()
const projectKey = `S${faker.string.alphanumeric({
  length: 7,
  casing: "upper",
})}`
const ticketCount = faker.number.int({ min: 12, max: 18 })

const members = Array.from({ length: 5 }, () => {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()

  return {
    id: `seed-${faker.string.uuid()}`,
    username: faker.internet.username({ firstName, lastName }).toLowerCase(),
    firstName,
    lastName,
    syncedAt: now,
  }
})

const labelNames = faker.helpers.arrayElements(
  [
    "Accessibility",
    "Bug",
    "Design",
    "Documentation",
    "Feature",
    "Infrastructure",
    "Integration",
    "Operations",
    "Performance",
    "Research",
    "Security",
    "Testing",
  ],
  { min: 6, max: 8 },
)

const labelValues = labelNames.map((name) => ({
  name,
  color: faker.color.rgb(),
}))

const columnValues = [
  {
    id: faker.string.uuid(),
    name: "Backlog",
    category: "backlog" as const,
    position: 1024,
    color: "#64748b",
    wipLimit: null,
  },
  {
    id: faker.string.uuid(),
    name: "In progress",
    category: "in_progress" as const,
    position: 2048,
    color: "#2563eb",
    wipLimit: faker.number.int({ min: 3, max: 6 }),
  },
  {
    id: faker.string.uuid(),
    name: "Review",
    category: "testing" as const,
    position: 3072,
    color: "#d97706",
    wipLimit: faker.number.int({ min: 2, max: 4 }),
  },
  {
    id: faker.string.uuid(),
    name: "Done",
    category: "done" as const,
    position: 4096,
    color: "#16a34a",
    wipLimit: null,
  },
]

function textDocument(...paragraphs: string[]): RichTextDocument {
  return {
    type: "doc",
    content: paragraphs.map((paragraph) => ({
      type: "paragraph",
      content: [{ type: "text", text: paragraph }],
    })),
  }
}

function mentionDocument(
  before: string,
  memberId: string,
  label: string,
  after: string,
): RichTextDocument {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: before },
          {
            type: "mention",
            attrs: {
              id: memberId,
              label,
              mentionSuggestionChar: "@",
            },
          },
          { type: "text", text: after },
        ],
      },
    ],
  }
}

function memberName(member: (typeof members)[number]) {
  return `${member.firstName} ${member.lastName}`
}

function ticketTitle() {
  const verb = faker.helpers.arrayElement([
    "Audit",
    "Build",
    "Document",
    "Improve",
    "Refactor",
    "Review",
    "Ship",
    "Test",
  ])
  return `${verb} the ${faker.hacker.adjective()} ${faker.hacker.noun()}`
}

const columnTicketCounts = new Map(columnValues.map((column) => [column.id, 0]))
const generatedTickets = Array.from({ length: ticketCount }, (_, index) => {
  const column = columnValues[index % columnValues.length]
  const position = (columnTicketCounts.get(column.id)! + 1) * 1024
  columnTicketCounts.set(column.id, position / 1024)

  const isDone = column.category === "done"
  const description = faker.lorem.sentences({ min: 1, max: 3 })

  return {
    number: index + 1,
    title: ticketTitle(),
    description,
    descriptionDocument: textDocument(description),
    columnId: column.id,
    reporterId: faker.helpers.arrayElement(members).id,
    assigneeIds: faker.helpers
      .arrayElements(members, { min: 1, max: 3 })
      .map((member) => member.id),
    labelNames: faker.helpers.arrayElements(labelNames, { min: 1, max: 3 }),
    estimate: faker.helpers.arrayElement([1, 2, 3, 5, 8]),
    dueDate:
      isDone || faker.datatype.boolean({ probability: 0.25 })
        ? null
        : faker.date.soon({ days: 30, refDate: now }),
    position,
    priority: faker.helpers.arrayElement(
      ["urgent", "high", "medium", "low", "none"] as const,
    ),
    createdAt: faker.date.recent({ days: 30, refDate: now }),
    completedAt: isDone
      ? faker.date.recent({ days: 14, refDate: now })
      : null,
  }
})

try {
  const featuredTicketNumber = await db.transaction(async (tx) => {
    await tx.insert(users).values(members)

    const [project] = await tx
      .insert(projects)
      .values({
        key: projectKey,
        name: `${faker.company.catchPhraseAdjective()} ${faker.company.catchPhraseNoun()}`,
        description: faker.company.catchPhrase(),
        leadUserId: faker.helpers.arrayElement(members).id,
        color: faker.color.rgb(),
        icon: faker.helpers.arrayElement([
          "🧭",
          "🌱",
          "🚀",
          "🏗️",
          "💡",
          "🗺️",
        ]),
        nextTicketNumber: ticketCount + 1,
      })
      .returning({ id: projects.id })

    const [board] = await tx
      .insert(boards)
      .values({
        projectId: project.id,
        name: `${faker.word.adjective()} delivery board`,
      })
      .returning({ id: boards.id })

    await tx.insert(columns).values(
      columnValues.map((column) => ({
        ...column,
        boardId: board.id,
      })),
    )

    const savedLabels = await tx
      .insert(labels)
      .values(labelValues.map((label) => ({ projectId: project.id, ...label })))
      .returning({ id: labels.id, name: labels.name })
    const labelIds = new Map(
      savedLabels.map((label) => [label.name, label.id]),
    )

    const ticketIds = new Map<number, string>()

    for (const ticket of generatedTickets) {
      const [savedTicket] = await tx
        .insert(tickets)
        .values({
          projectId: project.id,
          number: ticket.number,
          title: ticket.title,
          description: ticket.description,
          descriptionDocument: ticket.descriptionDocument,
          columnId: ticket.columnId,
          reporterId: ticket.reporterId,
          estimate: ticket.estimate,
          dueDate: ticket.dueDate,
          position: ticket.position,
          priority: ticket.priority,
          createdAt: ticket.createdAt,
          updatedAt: now,
          completedAt: ticket.completedAt,
        })
        .returning({ id: tickets.id })

      ticketIds.set(ticket.number, savedTicket.id)

      await tx.insert(ticketAssignees).values(
        ticket.assigneeIds.map((userId) => ({
          ticketId: savedTicket.id,
          userId,
        })),
      )

      await tx.insert(ticketLabels).values(
        ticket.labelNames.map((name) => ({
          ticketId: savedTicket.id,
          labelId: labelIds.get(name)!,
        })),
      )
    }

    const [commentAuthor, mentionedMember, discordAuthor] =
      faker.helpers.shuffle(members)
    const featuredTicket = faker.helpers.arrayElement(generatedTickets)
    const featuredTicketId = ticketIds.get(featuredTicket.number)!
    const mentionRequest = faker.helpers.arrayElement([
      " review the latest changes before the next board update?",
      " verify the acceptance criteria before this moves forward?",
      " test the keyboard flow and add the results here?",
      " check the Discord summary for anything we missed?",
    ])
    const mentionBody = `Could @${memberName(mentionedMember)}${mentionRequest}`
    const discordBody = faker.helpers.arrayElement([
      "Checked it and added the remaining edge cases to the review notes.",
      "The latest version looks good. I left one follow-up for the next iteration.",
      "Tested the flow end to end and shared the results with the project channel.",
      "I verified the acceptance criteria and everything is ready for review.",
    ])
    const discordMessageId = faker.string.numeric(18)

    await tx.insert(ticketComments).values([
      {
        ticketId: featuredTicketId,
        body: mentionBody,
        bodyDocument: mentionDocument(
          "Could ",
          mentionedMember.id,
          memberName(mentionedMember),
          mentionRequest,
        ),
        source: "logbook",
        authorUserId: commentAuthor.id,
        syncStatus: "synced",
        createdAt: faker.date.recent({ days: 3, refDate: now }),
      },
      {
        ticketId: featuredTicketId,
        body: discordBody,
        bodyDocument: textDocument(discordBody),
        source: "discord",
        authorUserId: discordAuthor.id,
        discordUserId: faker.string.numeric(18),
        discordUsername: discordAuthor.username,
        discordDisplayName: memberName(discordAuthor),
        discordMessageId,
        discordMessageUrl: `https://discord.com/channels/${faker.string.numeric(18)}/${faker.string.numeric(18)}/${discordMessageId}`,
        syncStatus: "synced",
        createdAt: faker.date.recent({ days: 1, refDate: now }),
      },
    ])

    await tx
      .insert(helmDirectorySyncs)
      .values({
        key: "helm-members",
        lastCompletedAt: now,
        leaseUntil: null,
      })
      .onConflictDoUpdate({
        target: helmDirectorySyncs.key,
        set: { lastCompletedAt: now, leaseUntil: null },
      })

    return featuredTicket.number
  })

  console.log(`Created ${projectKey} with ${ticketCount} generated tickets.`)
  console.log(`Board: /projects/${projectKey}/board`)
  console.log(`Mention example: /tickets/${projectKey}-${featuredTicketNumber}`)
} finally {
  await client.end()
}
