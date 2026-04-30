"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserTypesForAction } from "@/lib/auth";
import { generateProjectCode } from "@/lib/project-code";

export type ProjectFormState = { success?: boolean; error?: string };

const baseSchema = z.object({
  clientId: z.string().optional(),
  projectTypeId: z.string().optional().nullable(),
  name: z.string().min(2, "Project name is required."),
  billingModel: z.enum(["HOURLY", "FIXED_FULL", "FIXED_MONTHLY"]),
  fixedContractHours: z.coerce.number().nonnegative().optional(),
  fixedMonthlyHours: z.coerce.number().nonnegative().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]),
  description: z.string().optional(),
  hideCountriesInEntries: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
  hideMoviesInEntries: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
  hideAssetTypesInEntries: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
  addToBilling: z.union([z.literal("on"), z.literal("true"), z.literal("1")]).optional(),
});

async function validateProjectType(clientId: string, projectTypeId?: string | null) {
  if (!projectTypeId) return null;
  return db.projectType.findFirst({ where: { id: projectTypeId, clientId, isActive: true }, select: { id: true, name: true } });
}

export async function createProjectAction(_prevState: ProjectFormState, formData: FormData): Promise<ProjectFormState> {
  try {
    const user = await requireUserTypesForAction(["ADMIN", "MANAGER", "TEAM_LEAD"]);
    const parsed = baseSchema.safeParse({ clientId: String(formData.get('clientId') ?? ''), projectTypeId: String(formData.get('projectTypeId') ?? '') || null, name: String(formData.get('name') ?? ''), billingModel: formData.get('billingModel'), fixedContractHours: formData.get('fixedContractHours') || 0, fixedMonthlyHours: formData.get('fixedMonthlyHours') || 0, status: formData.get('status'), description: String(formData.get('description') ?? ''), hideCountriesInEntries: formData.get('hideCountriesInEntries') ?? undefined, hideMoviesInEntries: formData.get('hideMoviesInEntries') ?? undefined, hideAssetTypesInEntries: formData.get('hideAssetTypesInEntries') ?? undefined, addToBilling: formData.get('addToBilling') ?? undefined });
    if (!parsed.success || !parsed.data.clientId) return { success: false, error: parsed.success ? 'Client is required.' : parsed.error.issues[0]?.message };
    const client = await db.client.findUnique({ where: { id: parsed.data.clientId }, select: { id: true, enableProjectTypes: true, showCountriesInTimeEntries: true, showMoviesInEntries: true, showAssetTypesInEntries: true } });
    if (!client) return { success: false, error: 'Client not found.' };
    if (client.enableProjectTypes && !parsed.data.projectTypeId) return { success: false, error: 'Project type is required for the selected client.' };
    if (!client.enableProjectTypes && parsed.data.projectTypeId) return { success: false, error: 'Selected client does not use project types.' };
    if (parsed.data.projectTypeId && !(await validateProjectType(client.id, parsed.data.projectTypeId))) return { success: false, error: 'Selected project type is invalid for the chosen client.' };
    const projectCode = await generateProjectCode(client.id);
    await db.project.create({ data: { clientId: client.id, projectTypeId: parsed.data.projectTypeId || null, name: parsed.data.name.trim(), code: projectCode, billingModel: parsed.data.billingModel, fixedContractHours: parsed.data.billingModel === 'FIXED_FULL' ? (parsed.data.fixedContractHours ?? 0) : null, fixedMonthlyHours: parsed.data.billingModel === 'FIXED_MONTHLY' ? (parsed.data.fixedMonthlyHours ?? 0) : null, status: parsed.data.status, description: parsed.data.description || null, createdById: user.id, updatedById: user.id, hideCountriesInEntries: client.showCountriesInTimeEntries ? Boolean(parsed.data.hideCountriesInEntries) : false, hideMoviesInEntries: client.showMoviesInEntries ? Boolean(parsed.data.hideMoviesInEntries) : false, hideAssetTypesInEntries: client.showAssetTypesInEntries ? Boolean(parsed.data.hideAssetTypesInEntries) : false, addToBilling: Boolean(parsed.data.addToBilling) } });
    revalidatePath('/projects'); revalidatePath('/projects/new'); revalidatePath('/user-assignments'); revalidatePath('/dashboard'); revalidatePath('/time-entries'); revalidatePath('/estimates');
    return { success: true };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Something went wrong.' }; }
}

const projectUpdateSchema = baseSchema.omit({ clientId: true });
export async function updateProjectAction(projectId: string, _prevState: ProjectFormState, formData: FormData): Promise<ProjectFormState> {
  try {
    const user = await requireUserTypesForAction(["ADMIN", "MANAGER", "TEAM_LEAD"]);
    const existingProject = await db.project.findUnique({ where: { id: projectId }, select: { id: true, clientId: true } });
    if (!existingProject) return { success: false, error: 'Project not found.' };
    const parsed = projectUpdateSchema.safeParse({ projectTypeId: String(formData.get('projectTypeId') ?? '') || null, name: String(formData.get('name') ?? ''), billingModel: formData.get('billingModel'), fixedContractHours: formData.get('fixedContractHours') || 0, fixedMonthlyHours: formData.get('fixedMonthlyHours') || 0, status: formData.get('status'), description: String(formData.get('description') ?? ''), hideCountriesInEntries: formData.get('hideCountriesInEntries') ?? undefined, hideMoviesInEntries: formData.get('hideMoviesInEntries') ?? undefined, hideAssetTypesInEntries: formData.get('hideAssetTypesInEntries') ?? undefined, addToBilling: formData.get('addToBilling') ?? undefined });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || 'Invalid project payload.' };
    const client = await db.client.findUnique({ where: { id: existingProject.clientId }, select: { id: true, enableProjectTypes: true, showCountriesInTimeEntries: true, showMoviesInEntries: true, showAssetTypesInEntries: true } });
    if (!client) return { success: false, error: 'Client not found.' };
    if (client.enableProjectTypes && !parsed.data.projectTypeId) return { success: false, error: 'Project type is required for the selected client.' };
    if (!client.enableProjectTypes && parsed.data.projectTypeId) return { success: false, error: 'Selected client does not use project types.' };
    if (parsed.data.projectTypeId && !(await validateProjectType(client.id, parsed.data.projectTypeId))) return { success: false, error: 'Selected project type is invalid for the chosen client.' };
    await db.project.update({ where: { id: projectId }, data: { projectTypeId: parsed.data.projectTypeId || null, name: parsed.data.name.trim(), billingModel: parsed.data.billingModel, fixedContractHours: parsed.data.billingModel === 'FIXED_FULL' ? (parsed.data.fixedContractHours ?? 0) : null, fixedMonthlyHours: parsed.data.billingModel === 'FIXED_MONTHLY' ? (parsed.data.fixedMonthlyHours ?? 0) : null, status: parsed.data.status, description: parsed.data.description || null, updatedById: user.id, hideCountriesInEntries: client.showCountriesInTimeEntries ? Boolean(parsed.data.hideCountriesInEntries) : false, hideMoviesInEntries: client.showMoviesInEntries ? Boolean(parsed.data.hideMoviesInEntries) : false, hideAssetTypesInEntries: client.showAssetTypesInEntries ? Boolean(parsed.data.hideAssetTypesInEntries) : false, addToBilling: Boolean(parsed.data.addToBilling) } });
    revalidatePath('/projects'); revalidatePath(`/projects/${projectId}`); revalidatePath(`/projects/${projectId}/edit`); revalidatePath('/user-assignments'); revalidatePath('/dashboard'); revalidatePath('/time-entries'); revalidatePath('/estimates');
    return { success: true };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Something went wrong.' }; }
}

const billingTransactionSchema = z.object({ projectId: z.string().min(1), type: z.enum(["PARTIAL_BILLING","UPGRADE_PRE_COMPLETION","UPGRADE_POST_COMPLETION","ADJUSTMENT"]), amount: z.coerce.number().nonnegative(), note: z.string().min(2, "Note is required.") });
export async function createBillingTransactionAction(formData: FormData) { await requireUserTypesForAction(["ADMIN", "MANAGER"]); const parsed = billingTransactionSchema.safeParse({ projectId: formData.get('projectId'), type: formData.get('type'), amount: formData.get('amount'), note: formData.get('note') }); if(!parsed.success) throw new Error(parsed.error.issues[0]?.message || 'Invalid billing transaction payload'); await db.billingTransaction.create({ data:{ projectId: parsed.data.projectId, transactionType: parsed.data.type, amountMoney: parsed.data.amount, amountHours: null, description: parsed.data.note, effectiveDate: new Date() } }); revalidatePath(`/projects/${parsed.data.projectId}`); revalidatePath('/projects'); }
export async function toggleProjectStatusAction(formData: FormData) { await requireUserTypesForAction(["ADMIN", "MANAGER","TEAM_LEAD"]); const projectId=String(formData.get('projectId')||''); if(!projectId) throw new Error('Project is required.'); const project=await db.project.findUnique({where:{id:projectId}}); if(!project) throw new Error('Project not found.'); await db.project.update({where:{id:projectId},data:{isActive:!project.isActive}}); revalidatePath('/projects'); revalidatePath(`/projects/${projectId}`); revalidatePath(`/projects/${projectId}/edit`); }
