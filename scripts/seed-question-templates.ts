import "dotenv/config";
import { db } from "@/lib/db/client";
import { questionTemplates, questionTemplateItems } from "@/lib/db/schema";

const SYSTEM_TEMPLATES = [
  {
    id: "qt-engineering",
    name: "Engineering Standard",
    description: "5 questions for technical roles",
    items: [
      { text: "Years of experience?", type: "short-text" },
      { text: "What's your preferred tech stack?", type: "long-text" },
      { text: "GitHub or portfolio URL?", type: "short-text" },
      { text: "When can you start?", type: "short-text" },
      { text: "Open to a paid test task?", type: "yes-no" },
    ],
  },
  {
    id: "qt-sales",
    name: "Sales Standard",
    description: "4 questions for sales roles",
    items: [
      { text: "Years of sales experience?", type: "short-text" },
      { text: "What industries have you sold to?", type: "long-text" },
      { text: "Comfortable with cold outreach?", type: "yes-no" },
      { text: "When can you start?", type: "short-text" },
    ],
  },
  {
    id: "qt-quick",
    name: "Quick Screen",
    description: "3 questions for high-volume vacancies",
    items: [
      { text: "Years of relevant experience?", type: "short-text" },
      { text: "Why are you interested in this role?", type: "long-text" },
      { text: "When can you start?", type: "short-text" },
    ],
  },
];

async function main() {
  for (const tpl of SYSTEM_TEMPLATES) {
    await db.insert(questionTemplates).values({
      id: tpl.id,
      name: tpl.name,
      description: tpl.description,
      isSystem: true,
    }).onConflictDoNothing();

    for (let i = 0; i < tpl.items.length; i++) {
      const item = tpl.items[i];
      await db.insert(questionTemplateItems).values({
        id: `${tpl.id}-q${i}`,
        templateId: tpl.id,
        text: item.text,
        type: item.type,
        options: null,
        orderIndex: i,
      }).onConflictDoNothing();
    }
    console.log(`Seeded: ${tpl.name}`);
  }
  process.exit(0);
}

main().catch(console.error);
