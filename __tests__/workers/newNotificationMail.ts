import { expectSuccessfulBackground } from '../helpers';
import { sendEmail } from '../../src/common';
import worker from '../../src/workers/newNotificationMail';
import {
  NotificationType,
  Post,
  Submission,
  SubmissionStatus,
  User,
  Source,
  Comment,
  SourceRequest,
} from '../../src/entity';
import { usersFixture } from '../fixture/user';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  generateNotification,
  NotificationBaseContext,
  NotificationCommentContext,
  NotificationCommenterContext,
  NotificationPostContext,
  NotificationSourceContext,
  NotificationSourceRequestContext,
  NotificationSubmissionContext,
  NotificationUpvotersContext,
  storeNotificationBundle,
} from '../../src/notifications';
import { MailDataRequired } from '@sendgrid/helpers/classes/mail';
import { postsFixture } from '../fixture/post';
import { sourcesFixture } from '../fixture/source';

jest.mock('../../src/common/mailing', () => ({
  ...(jest.requireActual('../../src/common/mailing') as Record<
    string,
    unknown
  >),
  sendEmail: jest.fn(),
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await con.getRepository(User).save(usersFixture);
  await con.getRepository(Source).save(sourcesFixture);
});

const saveNotificationFixture = async (
  type: NotificationType,
  ctx: NotificationBaseContext,
): Promise<string> => {
  const res = await con.transaction((entityManager) =>
    storeNotificationBundle(entityManager, [generateNotification(type, ctx)]),
  );
  return res[0].id;
};

it('should set parameters for community_picks_failed email', async () => {
  const submission = await con.getRepository(Submission).save({
    url: 'http://sample.abc.com',
    createdAt: new Date(2022, 11, 12),
    status: SubmissionStatus.Rejected,
    userId: '1',
  });
  const ctx: NotificationSubmissionContext = {
    userId: '1',
    submission: { id: submission.id },
  };

  const notificationId = await saveNotificationFixture(
    'community_picks_failed',
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toBeCalledTimes(1);
  const args = jest.mocked(sendEmail).mock.calls[0][0] as MailDataRequired;
  expect(args.dynamicTemplateData).toEqual({
    article_link: 'http://sample.abc.com',
    first_name: 'Ido',
    reason: expect.any(String),
    submitted_at: 'Dec 12, 2022',
  });
  expect(args.templateId).toEqual('d-43cf7ff439ff4391839e946940499b30');
});

it('should set parameters for community_picks_succeeded email', async () => {
  await con.getRepository(Submission).save({
    url: 'http://sample.abc.com',
    createdAt: new Date(2022, 11, 12),
    status: SubmissionStatus.Accepted,
    userId: '1',
  });
  const post = await con.getRepository(Post).save({
    ...postsFixture[0],
    url: 'http://sample.abc.com',
  });
  const ctx: NotificationPostContext = {
    userId: '1',
    post,
  };

  const notificationId = await saveNotificationFixture(
    'community_picks_succeeded',
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toBeCalledTimes(1);
  const args = jest.mocked(sendEmail).mock.calls[0][0] as MailDataRequired;
  expect(args.dynamicTemplateData).toEqual({
    article_link: 'http://sample.abc.com',
    discussion_link:
      'http://localhost:5002/posts/p1?utm_source=notification&utm_medium=email&utm_campaign=community_picks_succeeded',
    first_name: 'Ido',
    post_image: 'https://daily.dev/image.jpg',
    post_title: 'P1',
    submitted_at: 'Dec 12, 2022',
  });
  expect(args.templateId).toEqual('d-ee7d7cfc461a43b4be776f70940fa867');
});

it('should set parameters for community_picks_granted email', async () => {
  const ctx: NotificationBaseContext = {
    userId: '1',
  };

  const notificationId = await saveNotificationFixture(
    'community_picks_granted',
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toBeCalledTimes(1);
  const args = jest.mocked(sendEmail).mock.calls[0][0] as MailDataRequired;
  expect(args.dynamicTemplateData).toEqual({
    first_name: 'Ido',
  });
  expect(args.templateId).toEqual('d-6d17b936f1f245e486f1a85323240332');
});

it('should set parameters for article_picked email', async () => {
  const post = await con.getRepository(Post).save(postsFixture[0]);
  const ctx: NotificationPostContext = {
    userId: '1',
    post,
  };

  const notificationId = await saveNotificationFixture('article_picked', ctx);
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toBeCalledTimes(1);
  const args = jest.mocked(sendEmail).mock.calls[0][0] as MailDataRequired;
  expect(args.dynamicTemplateData).toEqual({
    discussion_link:
      'http://localhost:5002/posts/p1?utm_source=notification&utm_medium=email&utm_campaign=article_picked',
    post_image: 'https://daily.dev/image.jpg',
    post_title: 'P1',
  });
  expect(args.templateId).toEqual('d-3d3402ec873640e788f549a0680c40bb');
});

it('should set parameters for article_new_comment email', async () => {
  const post = await con.getRepository(Post).save(postsFixture[0]);
  const comment = await con.getRepository(Comment).save({
    id: 'c1',
    postId: 'p1',
    userId: '2',
    content: 'parent comment',
    createdAt: new Date(2020, 1, 6, 0, 0),
    upvotes: 5,
  });
  const commenter = await con.getRepository(User).findOneBy({ id: '2' });
  const ctx: NotificationCommenterContext = {
    userId: '1',
    post,
    comment,
    commenter,
  };

  const notificationId = await saveNotificationFixture(
    'article_new_comment',
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toBeCalledTimes(1);
  const args = jest.mocked(sendEmail).mock.calls[0][0] as MailDataRequired;
  expect(args.dynamicTemplateData).toEqual({
    discussion_link:
      'http://localhost:5002/posts/p1#c-c1?utm_source=notification&utm_medium=email&utm_campaign=article_new_comment',
    full_name: 'Tsahi',
    new_comment: 'parent comment',
    post_image: 'https://daily.dev/image.jpg',
    post_title: 'P1',
    profile_image: 'https://daily.dev/tsahi.jpg',
    user_reputation: 10,
  });
  expect(args.templateId).toEqual('d-aba78d1947b14307892713ad6c2cafc5');
});

it('should set parameters for article_upvote_milestone email', async () => {
  const post = await con.getRepository(Post).save(postsFixture[0]);
  const ctx: NotificationPostContext & NotificationUpvotersContext = {
    userId: '1',
    post,
    upvotes: 50,
    upvoters: [],
  };

  const notificationId = await saveNotificationFixture(
    'article_upvote_milestone',
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toBeCalledTimes(1);
  const args = jest.mocked(sendEmail).mock.calls[0][0] as MailDataRequired;
  expect(args.dynamicTemplateData).toEqual({
    discussion_link:
      'http://localhost:5002/posts/p1?utm_source=notification&utm_medium=email&utm_campaign=article_upvote_milestone',
    post_image: 'https://daily.dev/image.jpg',
    post_title: 'P1',
    upvotes: '50',
  });
  expect(args.templateId).toEqual('d-f9bff38d48dd4492b6db3dde0eebabd6');
});

it('should set parameters for article_report_approved email', async () => {
  const post = await con.getRepository(Post).save(postsFixture[0]);
  const ctx: NotificationPostContext = {
    userId: '1',
    post,
  };

  const notificationId = await saveNotificationFixture(
    'article_report_approved',
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toBeCalledTimes(1);
  const args = jest.mocked(sendEmail).mock.calls[0][0] as MailDataRequired;
  expect(args.dynamicTemplateData).toEqual({
    post_image: 'https://daily.dev/image.jpg',
    post_title: 'P1',
  });
  expect(args.templateId).toEqual('d-dc6edf61c52442689e8870a434d8811d');
});

it('should set parameters for article_analytics email', async () => {
  const post = await con.getRepository(Post).save({
    ...postsFixture[0],
    upvotes: 6,
    views: 11,
    comments: 2,
    authorId: '1',
  });
  await con.getRepository(Post).save({
    ...postsFixture[1],
    upvotes: 5,
    views: 10,
    comments: 1,
    authorId: '1',
  });
  const ctx: NotificationPostContext = {
    userId: '1',
    post,
  };

  const notificationId = await saveNotificationFixture(
    'article_analytics',
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toBeCalledTimes(1);
  const args = jest.mocked(sendEmail).mock.calls[0][0] as MailDataRequired;
  expect(args.dynamicTemplateData).toEqual({
    post_comments: '2',
    post_image: 'https://daily.dev/image.jpg',
    post_title: 'P1',
    post_upvotes: '6',
    post_upvotes_total: '11',
    post_views: '11',
    post_views_total: '21',
    profile_link:
      'http://localhost:5002/idoshamun?utm_source=notification&utm_medium=email&utm_campaign=article_analytics',
  });
  expect(args.templateId).toEqual('d-97c75b0e2cf847399d20233455736ba0');
});

it('should set parameters for source_approved email', async () => {
  const source = await con
    .getRepository(Source)
    .findOneBy({ id: sourcesFixture[0].id });
  const sourceRequest = await con.getRepository(SourceRequest).save({
    userId: '1',
    sourceUrl: 'https://daily.dev',
    sourceFeed: 'https://rss.com',
    closed: false,
  });
  const ctx: NotificationSourceRequestContext & NotificationSourceContext = {
    userId: '1',
    source,
    sourceRequest,
  };

  const notificationId = await saveNotificationFixture('source_approved', ctx);
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toBeCalledTimes(1);
  const args = jest.mocked(sendEmail).mock.calls[0][0] as MailDataRequired;
  expect(args.dynamicTemplateData).toEqual({
    rss_link: 'https://rss.com',
    source_image: 'http://image.com/a',
    source_link:
      'http://localhost:5002/sources/a?utm_source=notification&utm_medium=email&utm_campaign=source_approved',
    source_name: 'A',
  });
  expect(args.templateId).toEqual('d-d79367f86f1e4ca5afdf4c1d39ff7214');
});

it('should set parameters for source_rejected email', async () => {
  const sourceRequest = await con.getRepository(SourceRequest).save({
    userId: '1',
    sourceUrl: 'https://daily.dev',
    sourceFeed: 'https://rss.com',
    closed: false,
  });
  const ctx: NotificationSourceRequestContext = {
    userId: '1',
    sourceRequest,
  };

  const notificationId = await saveNotificationFixture('source_rejected', ctx);
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toBeCalledTimes(1);
  const args = jest.mocked(sendEmail).mock.calls[0][0] as MailDataRequired;
  expect(args.dynamicTemplateData).toEqual({
    first_name: 'Ido',
    rss_link: 'https://rss.com',
  });
  expect(args.templateId).toEqual('d-48de63612ff944cb8156fec17f47f066');
});

it('should set parameters for comment_mention email', async () => {
  const post = await con.getRepository(Post).save(postsFixture[0]);
  const comment = await con.getRepository(Comment).save({
    id: 'c1',
    postId: 'p1',
    userId: '2',
    content: 'parent comment',
    createdAt: new Date(2020, 1, 6, 0, 0),
    upvotes: 5,
  });
  const commenter = await con.getRepository(User).findOneBy({ id: '2' });
  const ctx: NotificationCommenterContext = {
    userId: '1',
    post,
    comment,
    commenter,
  };

  const notificationId = await saveNotificationFixture('comment_mention', ctx);
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toBeCalledTimes(1);
  const args = jest.mocked(sendEmail).mock.calls[0][0] as MailDataRequired;
  expect(args.dynamicTemplateData).toEqual({
    post_link:
      'http://localhost:5002/posts/p1#c-c1?utm_source=notification&utm_medium=email&utm_campaign=comment_mention',
    full_name: 'Tsahi',
    comment: 'parent comment',
    post_image: 'https://daily.dev/image.jpg',
    post_title: 'P1',
    commenter_profile_image: 'https://daily.dev/tsahi.jpg',
    user_reputation: 10,
  });
  expect(args.templateId).toEqual('d-6949e2e50def4c6698900032973d469b');
});

it('should set parameters for comment_reply email', async () => {
  const post = await con.getRepository(Post).save(postsFixture[0]);
  await con.getRepository(Comment).save({
    id: 'c1',
    postId: 'p1',
    userId: '1',
    content: 'parent comment',
    createdAt: new Date(2020, 1, 6, 0, 0),
  });
  const comment = await con.getRepository(Comment).save({
    id: 'c2',
    postId: 'p1',
    userId: '2',
    content: 'child comment',
    createdAt: new Date(2020, 1, 7, 0, 0),
    parentId: 'c1',
  });
  const commenter = await con.getRepository(User).findOneBy({ id: '2' });
  const ctx: NotificationCommenterContext = {
    userId: '1',
    post,
    comment,
    commenter,
  };

  const notificationId = await saveNotificationFixture('comment_reply', ctx);
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toBeCalledTimes(1);
  const args = jest.mocked(sendEmail).mock.calls[0][0] as MailDataRequired;
  expect(args.dynamicTemplateData).toEqual({
    commenter_profile_image: 'https://daily.dev/tsahi.jpg',
    commenter_reputation: 10,
    discussion_link:
      'http://localhost:5002/posts/p1#c-c2?utm_source=notification&utm_medium=email&utm_campaign=comment_reply',
    full_name: 'Tsahi',
    main_comment: 'parent comment',
    new_comment: 'child comment',
    post_title: 'P1',
    user_name: 'Ido',
    user_profile_image: 'https://daily.dev/ido.jpg',
    user_reputation: 10,
  });
  expect(args.templateId).toEqual('d-90c229bde4af427c8708a7615bfd85b4');
});

it('should set parameters for comment_upvote_milestone email', async () => {
  const post = await con.getRepository(Post).save(postsFixture[0]);
  const comment = await con.getRepository(Comment).save({
    id: 'c1',
    postId: 'p1',
    userId: '1',
    content: 'parent comment',
    createdAt: new Date(2020, 1, 6, 0, 0),
  });
  const ctx: NotificationCommentContext & NotificationUpvotersContext = {
    userId: '1',
    post,
    comment,
    upvotes: 50,
    upvoters: [],
  };

  const notificationId = await saveNotificationFixture(
    'comment_upvote_milestone',
    ctx,
  );
  await expectSuccessfulBackground(worker, {
    notification: {
      id: notificationId,
      userId: '1',
    },
  });
  expect(sendEmail).toBeCalledTimes(1);
  const args = jest.mocked(sendEmail).mock.calls[0][0] as MailDataRequired;
  expect(args.dynamicTemplateData).toEqual({
    discussion_link:
      'http://localhost:5002/posts/p1#c-c1?utm_source=notification&utm_medium=email&utm_campaign=comment_upvote_milestone',
    main_comment: 'parent comment',
    profile_image: 'https://daily.dev/ido.jpg',
    upvote_title: 'You rock! Your comment earned 50 upvotes!',
    user_name: 'Ido',
    user_reputation: 10,
  });
  expect(args.templateId).toEqual('d-92bca6102e3a4b41b6fc3f532f050429');
});