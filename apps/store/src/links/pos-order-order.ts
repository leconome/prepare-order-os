import { defineLink } from "@medusajs/framework/utils";
import OrderModule from "@medusajs/medusa/order";
import PosModule from "../modules/pos";

export default defineLink(PosModule.linkable.posOrder, {
	linkable: OrderModule.linkable.order,
	deleteCascade: true,
});
