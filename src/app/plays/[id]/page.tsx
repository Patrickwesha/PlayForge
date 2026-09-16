import { EditorClient } from '@/editor/EditorClient';

export default async function PlayEditorPage(props: PageProps<'/plays/[id]'>) {
  const { id } = await props.params;
  return <EditorClient kind="play" id={id} />;
}
