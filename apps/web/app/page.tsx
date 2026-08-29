import { AppShell }     from "@/app/components/shell/AppShell";
import { UploadScreen } from "@/app/components/upload/UploadScreen";

export default function Home() {
  return (
    <AppShell>
      <UploadScreen />
    </AppShell>
  );
}