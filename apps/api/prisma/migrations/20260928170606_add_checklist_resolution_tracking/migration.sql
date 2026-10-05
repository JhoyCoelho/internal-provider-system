-- AlterTable
ALTER TABLE "checklist_respostas" ADD COLUMN     "resolvido_em" TIMESTAMP(3),
ADD COLUMN     "resolvido_por_id" UUID;

-- AddForeignKey
ALTER TABLE "checklist_respostas" ADD CONSTRAINT "checklist_respostas_resolvido_por_id_fkey" FOREIGN KEY ("resolvido_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
