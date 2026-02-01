import { Box, Typography } from '@mui/material';

export default function TransactionsPage() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Transactions
      </Typography>
      <Typography variant="body1" color="text.secondary">
        View and manage all your transactions
      </Typography>
    </Box>
  );
}
