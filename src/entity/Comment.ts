import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { Post } from './Post';
import { User } from './User';

@Entity()
export class Comment {
  @PrimaryColumn({ length: 14 })
  id: string;

  @Column({ type: 'text' })
  @Index('IDX_comment_post_id')
  postId: string;

  @Column({ length: 36 })
  @Index('IDX_comment_user_id')
  userId: string;

  @Column({ length: 14, nullable: true })
  @Index('IDX_comment_parent_id')
  parentId: string | null;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'integer', default: 0 })
  @Index('IDX_comment_upvotes')
  upvotes: number;

  @Column({ type: 'integer', default: 0 })
  @Index('IDX_comment_comments')
  comments: number;

  @ManyToOne(() => Post, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;

  @ManyToOne(() => Comment, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  parent: Promise<Comment>;
}
