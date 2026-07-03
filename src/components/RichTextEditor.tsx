import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import { useCallback, useState } from 'react'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered,
  Quote, Code, Minus, AlignLeft, AlignCenter, AlignRight,
  Link as LinkIcon, Image as ImageIcon, Undo, Redo, Palette,
} from 'lucide-react'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

function ToolbarButton({
  onClick, active = false, title, children,
}: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-lg transition-colors ${
        active
          ? 'bg-primary/20 text-primary'
          : 'text-slate-400 hover:text-white hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-white/10 mx-1" />
}

function Toolbar({ editor }: { editor: Editor }) {
  const [linkUrl, setLinkUrl] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [showImageInput, setShowImageInput] = useState(false)

  const setLink = useCallback(() => {
    if (!linkUrl) { editor.chain().focus().unsetLink().run(); return }
    editor.chain().focus().setLink({ href: linkUrl, target: '_blank' }).run()
    setLinkUrl('')
    setShowLinkInput(false)
  }, [editor, linkUrl])

  const addImage = useCallback(() => {
    if (!imageUrl) return
    editor.chain().focus().setImage({ src: imageUrl }).run()
    setImageUrl('')
    setShowImageInput(false)
  }, [editor, imageUrl])

  return (
    <div className="border-b border-white/10 p-2 flex flex-wrap items-center gap-0.5 bg-white/[0.02]">
      {/* History */}
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
        <Undo className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
        <Redo className="w-3.5 h-3.5" />
      </ToolbarButton>
      <Divider />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        <Heading1 className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <Heading2 className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        <Heading3 className="w-3.5 h-3.5" />
      </ToolbarButton>
      <Divider />

      {/* Formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold"
      >
        <Bold className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic"
      >
        <Italic className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        title="Underline"
      >
        <UnderlineIcon className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title="Strikethrough"
      >
        <Strikethrough className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        title="Inline Code"
      >
        <Code className="w-3.5 h-3.5" />
      </ToolbarButton>
      <Divider />

      {/* Alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        active={editor.isActive({ textAlign: 'left' })}
        title="Align Left"
      >
        <AlignLeft className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        active={editor.isActive({ textAlign: 'center' })}
        title="Align Center"
      >
        <AlignCenter className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        active={editor.isActive({ textAlign: 'right' })}
        title="Align Right"
      >
        <AlignRight className="w-3.5 h-3.5" />
      </ToolbarButton>
      <Divider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <List className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Numbered List"
      >
        <ListOrdered className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="Blockquote"
      >
        <Quote className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal Rule"
      >
        <Minus className="w-3.5 h-3.5" />
      </ToolbarButton>
      <Divider />

      {/* Color */}
      <div className="flex items-center gap-1 relative">
        <ToolbarButton
          onClick={() => {}}
          title="Text Color"
        >
          <label className="flex items-center cursor-pointer">
            <Palette className="w-3.5 h-3.5 pointer-events-none" />
            <input
              type="color"
              className="absolute opacity-0 w-0 h-0"
              onChange={e => editor.chain().focus().setColor(e.target.value).run()}
            />
          </label>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().unsetColor().run()}
          title="Reset Color"
        >
          <span className="text-[9px] font-bold">A</span>
        </ToolbarButton>
      </div>
      <Divider />

      {/* Link */}
      <div className="relative flex items-center gap-1">
        <ToolbarButton
          onClick={() => { setShowLinkInput(!showLinkInput); setShowImageInput(false) }}
          active={editor.isActive('link') || showLinkInput}
          title="Insert Link"
        >
          <LinkIcon className="w-3.5 h-3.5" />
        </ToolbarButton>
        {showLinkInput && (
          <div className="absolute top-8 left-0 z-10 flex gap-1 bg-[#111] border border-white/20 rounded-lg p-1.5 shadow-xl min-w-[260px]">
            <input
              autoFocus
              type="url"
              placeholder="https://..."
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setLink()}
              className="flex-1 bg-transparent text-xs text-white outline-none px-2"
            />
            <button type="button" onClick={setLink} className="text-xs bg-primary text-black font-bold px-2 py-1 rounded">OK</button>
            <button type="button" onClick={() => setShowLinkInput(false)} className="text-xs text-slate-400 px-1">&times;</button>
          </div>
        )}
      </div>

      {/* Image */}
      <div className="relative flex items-center gap-1">
        <ToolbarButton
          onClick={() => { setShowImageInput(!showImageInput); setShowLinkInput(false) }}
          active={showImageInput}
          title="Insert Image"
        >
          <ImageIcon className="w-3.5 h-3.5" />
        </ToolbarButton>
        {showImageInput && (
          <div className="absolute top-8 left-0 z-10 flex gap-1 bg-[#111] border border-white/20 rounded-lg p-1.5 shadow-xl min-w-[260px]">
            <input
              autoFocus
              type="url"
              placeholder="URL gambar https://..."
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addImage()}
              className="flex-1 bg-transparent text-xs text-white outline-none px-2"
            />
            <button type="button" onClick={addImage} className="text-xs bg-primary text-black font-bold px-2 py-1 rounded">OK</button>
            <button type="button" onClick={() => setShowImageInput(false)} className="text-xs text-slate-400 px-1">&times;</button>
          </div>
        )}
      </div>
    </div>
  )
}

export function RichTextEditor({ value, onChange, placeholder = 'Tulis konten artikel di sini...' }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[300px] p-4 prose prose-invert prose-sm max-w-none text-slate-200',
      },
    },
  })

  if (!editor) return null

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden bg-black focus-within:border-primary transition-colors">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}
