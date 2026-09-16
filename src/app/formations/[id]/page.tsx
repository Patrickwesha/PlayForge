import { EditorClient } from '@/editor/EditorClient';

export default async function FormationEditorPage(props: PageProps<'/formations/[id]'>) {
  const { id } = await props.params;
  return <EditorClient kind="formation" id={id} />;
}
