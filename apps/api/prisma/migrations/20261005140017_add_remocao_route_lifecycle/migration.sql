-- AlterEnum
ALTER TYPE "RoleCode" ADD VALUE 'ADMIN';

-- AlterEnum
ALTER TYPE "StatusOrdemRemocao" ADD VALUE 'EM_OBSERVACAO';

-- AlterTable
ALTER TABLE "ordens_remocao" ADD COLUMN     "tentativas_falha" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "rotas_remocao" ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "cancelled_by_id" UUID;

-- AlterTable
ALTER TABLE "rotas_remocao_paradas" ADD COLUMN     "status_anterior" "StatusOrdemRemocao" NOT NULL DEFAULT 'ABERTO',
ADD COLUMN     "tecnico_anterior_id" UUID;

-- AddForeignKey
ALTER TABLE "rotas_remocao" ADD CONSTRAINT "rotas_remocao_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotas_remocao_paradas" ADD CONSTRAINT "rotas_remocao_paradas_tecnico_anterior_id_fkey" FOREIGN KEY ("tecnico_anterior_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
