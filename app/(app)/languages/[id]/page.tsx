import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LanguageForm } from "@/components/forms/language-form";
import { PageHeader } from "@/components/ui/page-header";
import { updateLanguageAction } from "@/lib/actions/language-actions";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageLanguages } from "@/lib/permissions";
export default async function LanguageEditPage({ params }: { params: Promise<{ id: string }>; }) {
 const user=await requireUser(); if(!canManageLanguages(user)) redirect('/dashboard');
 const {id}=await params; const language=await db.language.findUnique({ where:{id} }); if(!language) notFound();
 return <div className="space-y-6"><PageHeader title={`Edit language · ${language.name}`} description="Update language details and active status." actions={<Link href="/languages" className="btn-secondary">Back to languages</Link>}/><div className="max-w-3xl"><LanguageForm mode="edit" action={updateLanguageAction} initialValues={{id:language.id,name:language.name,code:language.code,isActive:language.isActive}}/></div></div>
}
