import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default parser definitions
  const parsers = [
    {
      id: 'generic_csv',
      name: 'Generic CSV',
      description: 'Generic CSV parser with customizable column mapping',
      fileType: 'csv',
      config: {
        delimiter: ',',
        hasHeader: true,
        encoding: 'utf-8',
        dateFormat: 'MM/dd/yyyy',
        columnMapping: {
          date: 'Date',
          description: 'Description',
          amountIn: 'Credit',
          amountOut: 'Debit',
          balance: 'Balance',
        },
      },
    },
    {
      id: 'chase_csv',
      name: 'Chase Bank CSV',
      description: 'Parser for Chase Bank CSV exports',
      fileType: 'csv',
      config: {
        delimiter: ',',
        hasHeader: true,
        encoding: 'utf-8',
        dateFormat: 'MM/dd/yyyy',
        columnMapping: {
          date: 'Transaction Date',
          description: 'Description',
          amount: 'Amount',
          type: 'Type',
          balance: 'Balance',
        },
        amountTransform: {
          type: 'single_column_signed',
          column: 'Amount',
        },
      },
    },
  ];

  for (const parser of parsers) {
    await prisma.parserDefinition.upsert({
      where: { id: parser.id },
      update: parser,
      create: parser,
    });
    console.log(`✓ Created parser: ${parser.name}`);
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
