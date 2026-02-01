import { Box, Typography } from '@mui/material';

export default function SettingsPage() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Manage your account and preferences
      </Typography>
    </Box>
  );
}
