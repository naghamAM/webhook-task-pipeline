type JobPayload = Record<string, any>;

type PipelineRow = {
  action_type: string;
  action_config: any;
};

export function processPayload(payload: JobPayload, pipeline: PipelineRow) {
  const { action_type, action_config } = pipeline;

  switch (action_type) {
    case "add_field": {
      const fieldName = action_config?.fieldName;
      const fieldValue = action_config?.fieldValue;

      if (!fieldName) {
        throw new Error("add_field action requires fieldName");
      }

      return {
        ...payload,
        [fieldName]: fieldValue,
      };
    }

    case "uppercase_name": {
      if (payload?.data?.name && typeof payload.data.name === "string") {
        return {
          ...payload,
          data: {
            ...payload.data,
            name: payload.data.name.toUpperCase(),
          },
        };
      }

      return payload;
    }

    case "filter_fields": {
      const allowedFields: string[] = action_config?.allowedFields ?? [];

      if (!Array.isArray(allowedFields)) {
        throw new Error("filter_fields action requires allowedFields array");
      }

      const filtered: Record<string, any> = {};

      for (const key of allowedFields) {
        if (key in payload) {
          filtered[key] = payload[key];
        }
      }

      return filtered;
    }

    default:
      throw new Error(`Unsupported action type: ${action_type}`);
  }
}
