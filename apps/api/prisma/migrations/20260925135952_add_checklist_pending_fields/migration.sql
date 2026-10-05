-- AlterTable
ALTER TABLE "checklists" ADD COLUMN     "categoria" VARCHAR(40) NOT NULL DEFAULT 'GERAL',
ADD COLUMN     "data_prevista" TIMESTAMP(3);
