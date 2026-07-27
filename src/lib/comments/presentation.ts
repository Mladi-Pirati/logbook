export type CommentAuthorPresentationInput = {
  author: {
    id: string
    firstName: string
    lastName: string
    discordUserId: string | null
  } | null
  discordUserId: string | null
  discordUsername: string | null
  discordDisplayName: string | null
}

export function getCommentAuthorPresentation(
  comment: CommentAuthorPresentationInput,
) {
  if (comment.author) {
    return {
      displayName: `${comment.author.firstName} ${comment.author.lastName}`,
      secondaryLabel: comment.author.discordUserId
        ? null
        : `Helm ${comment.author.id}`,
    }
  }

  return {
    displayName:
      comment.discordDisplayName ??
      comment.discordUsername ??
      "Discord user",
    secondaryLabel: comment.discordUserId
      ? `Discord ${comment.discordUserId}`
      : null,
  }
}
