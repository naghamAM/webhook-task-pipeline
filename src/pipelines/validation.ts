import { z } from "zod";

const actionTypeSchema = z.enum([
  "add_field",
  "uppercase_name",
  "filter_fields",
]);

const subscriberUrlSchema = z.url();

const addFieldConfigSchema = z.object({
  fieldName: z.string().trim().min(1, "fieldName is required"),
  fieldValue: z.unknown(),
});

const uppercaseNameConfigSchema = z.object({}).passthrough();

const filterFieldsConfigSchema = z.object({
  allowedFields: z
    .array(z.string().trim().min(1, "allowedFields cannot contain blanks"))
    .min(1, "allowedFields must contain at least one field"),
});

function getActionConfigSchema(actionType: z.infer<typeof actionTypeSchema>) {
  switch (actionType) {
    case "add_field":
      return addFieldConfigSchema;
    case "uppercase_name":
      return uppercaseNameConfigSchema;
    case "filter_fields":
      return filterFieldsConfigSchema;
  }
}

function validateActionConfig(
  actionType: z.infer<typeof actionTypeSchema>,
  actionConfig: unknown
) {
  return getActionConfigSchema(actionType).safeParse(actionConfig ?? {});
}

export const pipelineSchema = z
  .object({
    source_key: z.string().trim().min(1, "source_key is required"),
    action_type: actionTypeSchema,
    action_config: z.record(z.string(), z.unknown()).optional().default({}),
    subscriber_urls: z
      .array(subscriberUrlSchema)
      .min(1, "subscriber_urls must contain at least one URL"),
  })
  .superRefine((value, ctx) => {
    const configResult = validateActionConfig(
      value.action_type,
      value.action_config
    );

    if (!configResult.success) {
      for (const issue of configResult.error.issues) {
        ctx.addIssue({
          code: "custom",
          path: ["action_config", ...issue.path],
          message: issue.message,
        });
      }
    }
  });

export const pipelinePatchSchema = z
  .object({
    source_key: z.string().trim().min(1).optional(),
    action_type: actionTypeSchema.optional(),
    action_config: z.record(z.string(), z.unknown()).optional(),
    subscriber_urls: z
      .array(subscriberUrlSchema)
      .min(1, "subscriber_urls must contain at least one URL")
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided for update",
  });
