import { Box, Typography } from '@mui/material';

export default function ImportPage() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Import Transactions
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Upload and parse your bank statements
      </Typography>
    </Box>
  );
}
