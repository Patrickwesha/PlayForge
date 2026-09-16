import { PlaybookClient } from './PlaybookClient';

export default async function PlaybookPage(props: PageProps<'/playbooks/[id]'>) {
  const { id } = await props.params;
  return <PlaybookClient id={id} />;
}
