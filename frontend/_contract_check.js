const schema = {
  type: "object",
  properties: {
    suggested_actors: {
      type: "array",
      items: { type: "object", properties: { name: { type: "string" } } },
    },
    suggested_use_cases: {
      type: "array",
      items: {
        type: "object",
        properties: {
          specification_id: { type: "integer" },
          name: { type: "string" },
          description: { type: "string" },
        },
      },
    },
  },
  required: ["suggested_actors", "suggested_use_cases"],
};
const props = schema.properties;
const req = schema.required || Object.keys(props);
const list = Object.keys(props).filter((k) => props[k].type === "array");
const lines = [
  "YÊU CẦU ĐỊNH DẠNG NGHIÊM NGẶT:",
  "- Chỉ trả về DUY NHẤT một đối tượng JSON, không kèm markdown, không giải thích.",
  "- Các trường sau BẮT BUỘC có mặt: " + req.join(", ") + ".",
];
if (list.length) {
  lines.push(
    '- Các trường sau PHẢI là MẢNG phẳng (ký hiệu [ ... ]), TUYỆT ĐỐI không bọc trong object hay trong khóa "items": ' +
      list.join(", ") +
      ".",
  );
}
lines.push(
  "- Dùng ĐÚNG tên khóa trong schema; KHÔNG thay bằng từ đồng nghĩa (không dùng title, feature, actor_name thay cho name).",
);
lines.push("- Schema đầy đủ: " + JSON.stringify(schema));
console.log(lines.join("\n"));
