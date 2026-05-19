import "dotenv/config";
import { db } from "@/lib/db/client";
import { stageTemplates, stageTemplateStages } from "@/lib/db/schema";

const TEMPLATES = [
  {
    id: "tpl-full-funnel",
    name: "Standard Full Funnel",
    description: "Comprehensive 9-stage pipeline for most roles",
    stages: [
      { id: "tpl_full_funnel_1", name: "New Application",        color: "new",       isFinal: false, isRejected: false, isReserve: false, orderIndex: 0 },
      { id: "tpl_full_funnel_2", name: "Under Review",           color: "screening", isFinal: false, isRejected: false, isReserve: false, orderIndex: 1 },
      { id: "tpl_full_funnel_3", name: "Contacted",              color: "screening", isFinal: false, isRejected: false, isReserve: false, orderIndex: 2 },
      { id: "tpl_full_funnel_4", name: "Interview Scheduled",    color: "interview", isFinal: false, isRejected: false, isReserve: false, orderIndex: 3 },
      { id: "tpl_full_funnel_5", name: "Test Assignment",        color: "test",      isFinal: false, isRejected: false, isReserve: false, orderIndex: 4 },
      { id: "tpl_full_funnel_6", name: "Final Interview",        color: "interview", isFinal: false, isRejected: false, isReserve: false, orderIndex: 5 },
      { id: "tpl_full_funnel_7", name: "Hired",                  color: "hired",     isFinal: true,  isRejected: false, isReserve: false, orderIndex: 6 },
      { id: "tpl_full_funnel_8", name: "Rejected",               color: "rejected",  isFinal: true,  isRejected: true,  isReserve: false, orderIndex: 7 },
      { id: "tpl_full_funnel_9", name: "Talent Pool / Reserve",  color: "qualified", isFinal: true,  isRejected: false, isReserve: true,  orderIndex: 8 },
    ],
  },
  {
    id: "tpl_tech_hire",
    name: "Tech Hire (Standard)",
    description: "Standard software engineering pipeline",
    stages: [
      { id: "tpl_tech_1", name: "New",        color: "new",        isFinal: false, isRejected: false, isReserve: false, orderIndex: 0 },
      { id: "tpl_tech_2", name: "Screening",  color: "screening",  isFinal: false, isRejected: false, isReserve: false, orderIndex: 1 },
      { id: "tpl_tech_3", name: "Qualified",  color: "qualified",  isFinal: false, isRejected: false, isReserve: false, orderIndex: 2 },
      { id: "tpl_tech_4", name: "Test Task",  color: "test",       isFinal: false, isRejected: false, isReserve: false, orderIndex: 3 },
      { id: "tpl_tech_5", name: "Interview",  color: "interview",  isFinal: false, isRejected: false, isReserve: false, orderIndex: 4 },
      { id: "tpl_tech_6", name: "Hired",      color: "hired",      isFinal: true,  isRejected: false, isReserve: false, orderIndex: 5 },
      { id: "tpl_tech_7", name: "Rejected",   color: "rejected",   isFinal: true,  isRejected: true,  isReserve: false, orderIndex: 6 },
    ],
  },
  {
    id: "tpl_sales",
    name: "Sales / B2B",
    description: "Pipeline for sales and account management roles",
    stages: [
      { id: "tpl_sales_1", name: "New",       color: "new",       isFinal: false, isRejected: false, isReserve: false, orderIndex: 0 },
      { id: "tpl_sales_2", name: "Screening", color: "screening", isFinal: false, isRejected: false, isReserve: false, orderIndex: 1 },
      { id: "tpl_sales_3", name: "Interview", color: "interview", isFinal: false, isRejected: false, isReserve: false, orderIndex: 2 },
      { id: "tpl_sales_4", name: "Offer",     color: "qualified", isFinal: false, isRejected: false, isReserve: false, orderIndex: 3 },
      { id: "tpl_sales_5", name: "Hired",     color: "hired",     isFinal: true,  isRejected: false, isReserve: false, orderIndex: 4 },
      { id: "tpl_sales_6", name: "Rejected",  color: "rejected",  isFinal: true,  isRejected: true,  isReserve: false, orderIndex: 5 },
    ],
  },
  {
    id: "tpl_quick",
    name: "Quick Hire",
    description: "Streamlined 3-stage pipeline for fast hiring",
    stages: [
      { id: "tpl_quick_1", name: "New",       color: "new",       isFinal: false, isRejected: false, isReserve: false, orderIndex: 0 },
      { id: "tpl_quick_2", name: "Screening", color: "screening", isFinal: false, isRejected: false, isReserve: false, orderIndex: 1 },
      { id: "tpl_quick_3", name: "Hired",     color: "hired",     isFinal: true,  isRejected: false, isReserve: false, orderIndex: 2 },
      { id: "tpl_quick_4", name: "Rejected",  color: "rejected",  isFinal: true,  isRejected: true,  isReserve: false, orderIndex: 3 },
    ],
  },
];

async function main() {
  for (const tpl of TEMPLATES) {
    await db.insert(stageTemplates).values({ id: tpl.id, name: tpl.name, description: tpl.description, isSystem: true }).onConflictDoNothing();
    for (const stage of tpl.stages) {
      await db.insert(stageTemplateStages).values({ ...stage, templateId: tpl.id }).onConflictDoNothing();
    }
  }
  console.log("Stage templates seeded.");
}
main().catch(console.error).finally(() => process.exit());
