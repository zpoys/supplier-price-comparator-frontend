import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useAuth } from "./auth";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        (err as Error).message || "Login gagal. Periksa username dan password.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      minH="100vh"
      display="flex"
      alignItems="center"
      bg="gray.50"
      _dark={{ bg: "gray.700" }}
    >
      <Container maxW="md">
        <Box
          bg="white"
          borderWidth="1px"
          borderColor="gray.200"
          borderRadius="2xl"
          p={{ base: 6, md: 8 }}
          shadow="lg"
          _dark={{ bg: "gray.900", borderColor: "whiteAlpha.200" }}
        >
          <Stack spacing={6}>
            <Box>
              <Text fontWeight="800" fontSize="xl">
                BK{" "}
                <Text as="span" color="brand.500">
                  Jaya jaya jaya
                </Text>
              </Text>
              <Text color="gray.500" fontSize="sm">
                Supplier comparator
              </Text>
            </Box>
            <Box>
              <Heading size="lg">Login</Heading>
              <Text color="gray.500" mt={2} fontSize="sm">
                Masuk untuk melanjutkan ke dashboard.
              </Text>
            </Box>
            {error && (
              <Alert status="error" borderRadius="lg">
                <AlertIcon />
                {error}
              </Alert>
            )}
            <form onSubmit={submit}>
              <Stack spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Username</FormLabel>
                  <Input
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoFocus
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Password</FormLabel>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </FormControl>
                <Button
                  type="submit"
                  colorScheme="brand"
                  isLoading={loading}
                  loadingText="Memproses..."
                  width="full"
                >
                  Login
                </Button>
              </Stack>
            </form>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
