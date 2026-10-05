-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PermissionCode" ADD VALUE 'ORDERS_STATUS_WRITE';
ALTER TYPE "PermissionCode" ADD VALUE 'ORDERS_NOTE_WRITE';

-- AlterTable
ALTER TABLE "ordens_remocao" ADD COLUMN     "localizacao" VARCHAR(500) NOT NULL DEFAULT 'Não informado',
ADD COLUMN     "numero" VARCHAR(30) NOT NULL DEFAULT 'S/N',
ADD COLUMN     "ponto_referencia" VARCHAR(255) NOT NULL DEFAULT 'Não informado',
ADD COLUMN     "telefone_contato" VARCHAR(40),
ALTER COLUMN "equipamento_serial" DROP NOT NULL,
ALTER COLUMN "foto_serial_url" SET DATA TYPE TEXT,
ALTER COLUMN "foto_fachada_url" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "observacoes_remocao" (
    "id" UUID NOT NULL,
    "ordem_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "texto" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observacoes_remocao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "observacoes_remocao_ordem_id_created_at_idx" ON "observacoes_remocao"("ordem_id", "created_at");

-- AddForeignKey
ALTER TABLE "observacoes_remocao" ADD CONSTRAINT "observacoes_remocao_ordem_id_fkey" FOREIGN KEY ("ordem_id") REFERENCES "ordens_remocao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observacoes_remocao" ADD CONSTRAINT "observacoes_remocao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
